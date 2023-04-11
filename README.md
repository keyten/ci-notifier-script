# ci-notifier-script

### Install:
1. Clone the repo:
```
git clone git@github.com:keyten/ci-notifier-script.git
```

2. Make sure you've got `gh` (you can enter `gh`), if not:
```
brew install gh
gh auth login
```
You'll also need to have github token in env var `GITHUB_TOKEN` (requirement of gh).

3. Run install.sh and pass your repo folder:
```
chmod +x ./install.sh
./install.sh ~/work/repo
```

4. Add it into cron - input `crontab -e` and add in the end:
```
*/3 * * * 1-5 ~/ci-notifier-script/run.sh
```
_↑ example above runs the check every 3 mins_
