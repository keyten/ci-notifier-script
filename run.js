const fs = require('fs');
const path = require('path');
const { exec } = require("child_process");
const notifier = require('node-notifier');

const NOTIFY_ABOUT_PENDING = true;
const IGNORED_CHECKS = [
	// eg,
	// { name: 'Lint: TS' }
	// or
	// { context: 'buildkite/web-e2e-page' }

	// or eg we can ignore all completed checks by:
	// { state: 'SUCCESS' },
	// { status: 'COMPLETED' }

	// for more info - console.log the output of getPRList
];
const isCheckFailured = check => check.conclusion === 'FAILURE' || check.state === 'FAILURE';
const isCheckSuccessful = check => check.conclusion === 'SUCCESS';

const $ = cmd => new Promise(r => exec(cmd, (err, stdout, stderr) => {
	if (err) {
		console.error(err);
		return;
	}
	if (stderr) {
		console.error(stderr);
		return;
	}
	r(stdout);
}));
const objectFilters = (obj, filter) => {
	return Object.keys(filter).some(key => obj[key] === filter[key]);
};
const readJSON = filePath => {
  try {
    const data = fs.readFileSync(path.join(__dirname, filePath));
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error}`);
    return null;
  }
};
const writeJSON = (filePath, jsonData) => {
  try {
    const data = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(path.join(__dirname, filePath), data);
    console.log(`JSON data written to ${filePath}`);
  } catch (error) {
    console.error(`Error writing file ${filePath}: ${error}`);
  }
};
const formatTime = (date) => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

const getPRList = async () => {
	return JSON.parse(await $('/usr/local/bin/gh pr list -A "@me" --json "title,number,statusCheckRollup"'));
};

// the result of this function is saved and compared in the next run
// once it's changed - we show the message
const getPRStatus = async () => {
	const prs = await getPRList();
	const status = [];
	prs.forEach(pr => {
		// --- find out the status ---
		const checks = pr.statusCheckRollup.filter(statusCheck => {
			return !IGNORED_CHECKS.some(ignoredCheck => objectFilters(statusCheck, ignoredCheck));
		});

		const anyCheckFailured = checks.some(isCheckFailured);
		const allChecksPassed = checks.every(isCheckSuccessful);
		// if you rerun, the date will change and we wanna show you the message again
		const latestCheckStarted = checks.sort((a, b) => {
			return +(new Date(b.startedAt)) - +(new Date(a.startedAt));
		})[0];
		const dateOfLatestCheckStarted = latestCheckStarted && +new Date(latestCheckStarted.startedAt);

		status.push({
			number: pr.number,
			title: pr.title,
			status: anyCheckFailured ? 'failure' : allChecksPassed ? 'passed' : 'pending',
			dateOfLatestCheckStarted,
		});
	});
	return status;
}

const getLastSavedStatus = () => readJSON('last-saved-status.json');
const saveLastStatus = status => writeJSON('last-saved-status.json', status);

const notifyAboutPRStatus = status => {
	notifier.notify({
		title: 'Status: ' + status.status,
		icon: path.join(__dirname, status.status === 'passed' ? 'check_icon.png' : 'cross_icon.png'),
		appIcon: path.join(__dirname, status.status === 'passed' ? 'check_icon.png' : 'cross_icon.png'),
		contentImage: path.join(__dirname, status.status === 'passed' ? 'check_icon.png' : 'cross_icon.png'),
		message: status.title
	});
}

const main = async () => {
	const statuses = await getPRStatus();

	const lastStatus = await getLastSavedStatus();
	writeJSON('./logs/1.json', { statuses, lastStatus });

	// return;
	// joining new and old statuses
	const prs = {};
	statuses.forEach(newStatus => {
		prs[newStatus.number] = {
			newStatus,
		};
	});
	lastStatus.forEach(oldStatus => {
		if (prs[oldStatus.number]) {
			prs[oldStatus.number].oldStatus = oldStatus;
		}
	});
	
	const upd = [];
	Object.entries(prs).forEach(([prNumber, { newStatus, oldStatus }]) => {
		if (newStatus && oldStatus) {
			// pr existed before, pr exists now, check the status update
			if (
				(newStatus.status !== oldStatus.status || newStatus.dateOfLatestCheckStarted !== oldStatus.dateOfLatestCheckStarted) && (NOTIFY_ABOUT_PENDING || newStatus.status !== 'pending')
			) {
				notifyAboutPRStatus(newStatus);
				upd.push(newStatus.title);
			}
		} else if (newStatus) {
			// pr didn't exist before - check if it's success / fail anyway
			if ((NOTIFY_ABOUT_PENDING || newStatus.status !== 'pending')) {
				notifyAboutPRStatus(newStatus);
				upd.push(newStatus.title);
			}
		} else if (oldStatus) {
			// pr is merged / deleted, do nothing
		}
	});

	// notifier.notify({
	// 	title: 'Just worked',
	// 	message: JSON.stringify(upd)
	// });

	// // looking for differences
	// statuses.forEach(prStatus => {
	// 	const oldPrStatus = lastStatus.find(st => prStatus.number === st.number);
	// 	const changed = !oldPrStatus || prStatus.status !== oldPrStatus.status || prStatus.dateOfEarliestCheckStarted !== oldPrStatus.dateOfEarliestCheckStarted;

	// 	if (changed) {
	// 		// don't notify about pending
	// 		if (prStatus.status === 'pending') {
	// 			return;
	// 		}

	// 		// notifyAboutPRStatus(prStatus);
	// 	}
	// });

	saveLastStatus(statuses);
};

const start = new Date();
main().then(() => {
	const end = new Date();
	writeJSON('./logs/time.json', {
		start: formatTime(start),
		end: formatTime(end),
		delta: (+end - +start) / 1000,
	});
	console.log('Done');
});
