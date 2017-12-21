#!/usr/bin/env python

from operator import itemgetter
import sys

# maps words to their counts
counts = {}

stops = {'','i','me','my','myself','we','our','ours','ourselves','you','your','yours','yourself','yourselves','he','him','his','himself','she','her','hers','herself','it','its','itself','they','them','their','theirs','themselves','what','which','who','whom','this','that','these','those','am','is','are','was','were','be','been','being','have','has','had','having','do','does','did','doing','a','an','the','and','but','if','or','because','as','until','while','of','at','by','for','with','about','against','between','into','through','during','before','after','above','below','to','from','up','down','in','out','on','off','over','under','again','further','then','once','here','there','when','where','why','how','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','s','t','can','will','just','don','should','now'}

# input comes from STDIN
for line in sys.stdin:
	# remove leading and trailing whitespace
	line = line.strip()
	words = line.split(' ')
	words = [w.lower() for w in words]

	for w in words:

		# Skip stop words
		if w in stops:
			continue

		if not w in counts:
			counts[w] = 1
		else:
			counts[w] += 1

print sorted(counts.items(), key=lambda x: x[1])

