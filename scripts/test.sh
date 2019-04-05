#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

# Executes cleanup function at script exit.
trap cleanup EXIT

cleanup() {
  # Kill the ganache instance that we started (if we started one and if it's still running).
  if [ -n "$ganache_pid" ] && ps -p $ganache_pid > /dev/null; then
    kill -9 $ganache_pid
  fi
}

if [ "$SOLIDITY_COVERAGE" = true ]; then
  ganache_port=8555
else
  ganache_port=8555
fi

ganache_running() {
  nc -z localhost "$ganache_port"
}

start_ganache() {
 menomic_string="dog permit example repeat gloom defy teach pumpkin library remain scorpion skull"

  if [ "$SOLIDITY_COVERAGE" = true ]; then
    echo "Running Ganache CLI Coverage"
    node_modules/.bin/ganache-cli-coverage --emitFreeLogs true --allowUnlimitedContractSize true --gasLimit 0xfffffffffff --port "$ganache_port" -m "$menomic_string" -e 1000 -a 100 > /dev/null &
  else
    echo "Running Ganache"
    node_modules/.bin/ganache-cli --gasLimit 0xfffffffffff -m "$menomic_string" -e 1000 -a 100 -p $ganache_port > /dev/null &
  fi

  ganache_pid=$!
}

if ganache_running; then
  echo "Using existing ganache instance"
  
else
  echo "Starting our own ganache instance"
  start_ganache
  
  while :
  do
      if ganache_running 
      then
        break
      fi  
  done
  echo "Ganache up and Running"
fi

if [ "$SOLC_NIGHTLY" = true ]; then
  echo "Downloading solc nightly"
  wget -q https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/bin/soljson-nightly.js -O /tmp/soljson.js && find . -name soljson.js -exec cp /tmp/soljson.js {} \;
fi

if [ "$SOLIDITY_COVERAGE" = true ]; then
  node_modules/.bin/solidity-coverage

  if [ "$CONTINUOUS_INTEGRATION" = true ]; then
    cat coverage/lcov.info | node_modules/.bin/coveralls
  fi
else
  node_modules/.bin/truffle test "$@"
fi