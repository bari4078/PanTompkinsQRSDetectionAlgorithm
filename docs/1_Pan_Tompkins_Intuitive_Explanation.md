# The Pan-Tompkins Algorithm: An Intuitive Guide

The Pan-Tompkins algorithm is the gold standard for detecting QRS complexes (the main spike) in an Electrocardiogram (ECG) signal. If you've ever seen a heart monitor beep in a hospital, it's likely using a variation of this algorithm to count the heartbeats.

But how does a computer actually "see" that spike amidst all the noise, breathing artifacts, and muscle movements? It does so through a clever pipeline of 5 mathematical filters.

Think of the algorithm like a sculptor chipping away at a block of marble to reveal the statue inside. Each stage removes a specific type of "unwanted" stone until only the heartbeats remain.

---

## Stage 1: The Bandpass Filter (The Broad Sweep)

**The Problem:** The raw ECG signal is messy. When a patient breathes, the entire signal drifts up and down (baseline wander). When their muscles twitch, it adds high-frequency fuzz (muscle noise).
**The Solution:** The bandpass filter is like a bouncer at a club. It only lets frequencies between roughly 5 Hz and 15 Hz enter. 
* It blocks frequencies below 5 Hz (breathing).
* It blocks frequencies above 15 Hz (muscle noise and powerline interference).
* What's left? The QRS complex, which mostly lives in this 5-15 Hz range!

## Stage 2: The Derivative Filter (Finding the Steep Slopes)

**The Problem:** Even after cleaning the noise, there are other waves in the heartbeat (like the P wave and T wave). How do we distinguish the main QRS spike from the others?
**The Solution:** The QRS complex is the *steepest* part of the heartbeat. The derivative filter calculates the "slope" or "rate of change" of the signal. If the signal shoots up rapidly (like the R-peak), the derivative filter outputs a huge value. If it changes slowly (like the T wave), the output is small.

## Stage 3: The Squaring Filter (Amplifying the Slopes)

**The Problem:** The derivative output has both positive (shooting up) and negative (shooting down) values. We want to treat both the upward and downward slopes of the spike as important.
**The Solution:** We simply square the signal ($x^2$). 
1. It turns all negative values positive.
2. It *non-linearly amplifies* the signal. Large values (our steep slopes) become massive. Small values (background noise) remain small or shrink. The QRS complex now towers over everything else.

## Stage 4: Moving Window Integration (Gathering the Energy)

**The Problem:** After squaring, a single QRS complex might have multiple sharp peaks (e.g., one for the upward slope, one for the downward slope). We want *one* heartbeat to equal *one* lump.
**The Solution:** We slide a "window" of about 150 milliseconds across the signal and average the values inside it. This acts like a smoothing function. It gathers all the energy of a single QRS complex and merges it into one smooth, distinct, mountain-like lump.

## Stage 5: Thresholding and Peak Detection (The Final Decision)

**The Problem:** We now have a series of lumps, but how does the computer decide which lump is a heartbeat and which is just a random blip?
**The Solution:** We set a "threshold" (a horizontal line). 
* Any peak that crosses above this line is declared a heartbeat (R-peak).
* To prevent double-counting, we enforce a "minimum distance" between peaks. Since a human heart can't beat faster than ~200-300 times a minute, we tell the computer to ignore any peak that happens within 200 milliseconds of the previous one.

### Summary
1. **Bandpass:** Clean the noise.
2. **Derivative:** Find steep slopes.
3. **Squaring:** Make positive & amplify.
4. **Integration:** Smooth into a single lump.
5. **Threshold:** Count the lumps.
