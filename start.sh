#!/bin/sh
cd /home/z/my-project
rm -rf .next
NODE_OPTIONS="--max-old-space-size=4096" npx next dev --webpack -p 3000 -H 0.0.0.0 > /home/z/my-project/dev.log 2>&1

