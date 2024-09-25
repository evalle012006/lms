#!/bin/sh

node database/copy-mongo-to-postgres.js migrate-master

branchIds=669e68c727e6c5308696b769,647e678eb021fc463ed63cec,64f124140336c342acde9ae8,651e1f38fe9e9b760e604ba1,\
66a0d74727e6c5308698aef7,669e402627e6c5308696b09c,66b4c34c823bcfcd2b1ededf,639e80c8aeb5b756302b6cf8,66a37bed27e6c530869adb66,\
669105df70f4e8c8f67f7ca5,6690e36670f4e8c8f67f3c1e,639e80c8aeb5b756302b6cf4

node database/copy-mongo-to-postgres.js migrate-tx --branchId=$branchIds