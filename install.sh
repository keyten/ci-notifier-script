#!/usr/bin/env sh
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

echo "#!/usr/bin/env sh" > ./run.sh
echo "cd $1" >> ./run.sh
echo "PATH='${PATH}'" >> ./run.sh
echo "GITHUB_TOKEN='${GITHUB_TOKEN}'" >> ./run.sh
echo "/usr/local/bin/node ${SCRIPT_DIR}/run.js" >> ./run.sh
npm install
chmod +x ./run.sh
echo "[]" > ./last-saved-status.json
mkdir logs
echo "{}" > ./logs/1.json
