#!/bin/bash

tsVersions=("3.4" "3.5" "3.6" "3.7" "3.8" "3.9" "4.0" "4.1" "4.2" "4.3" "4.4" "4.5" "4.6" "4.7" "4.8" "4.9" "5.0" "5.1" "5.2" "5.3" "5.4" "5.5" "5.6" "5.7")

for version in "${tsVersions[@]}"; do
  echo "Testing with TypeScript $version"
  npx -y -p "typescript@$version" tsc --version
  npx -y -p "typescript@$version" tsc test/integ/baselines/actual/ts$version/test.d.ts --types --noEmit --lib es2015 --target es2015
done