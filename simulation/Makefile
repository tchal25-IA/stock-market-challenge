# Stock Market Challenge — GBM simulation
# Python 3.10+ (stdlib only)

.PHONY: simulate test

simulate:
	python3 gbm.py --ticks 500 --seed 42 --out out

test:
	python3 -m unittest test_gbm.py -v
