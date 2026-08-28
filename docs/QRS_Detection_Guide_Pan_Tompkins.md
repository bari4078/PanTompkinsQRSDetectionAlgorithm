# The CSE Student's Ultimate Guide to QRS Detection (and the Pan-Tompkins Algorithm)

Hello! If you're a Computer Science student who feels completely lost when people start talking about biology, electrocardiograms (ECGs), and signal processing, **you are in the exact right place**. 

We are going to build this up from absolute zero. We will pretend you know how to write an `if` statement and a `for` loop, but that you think a "ventricle" is a type of ventriloquist dummy. 

By the end of this document, you will deeply understand what a QRS complex is, how the legendary Pan-Tompkins algorithm works, and exactly how to code it in Python.

Let's dive in!

---

## Part 1: The Biology (Explained Like You're Five)

### The Heart is an Electrical House
Imagine a house with a water pump inside it. To make the pump squeeze the water out, you have to send an electrical shock to the pump's motor. 

Your heart is exactly like that pump, and the blood is the water. For your heart to pump blood around your body, your brain and nerves send an electrical spark through the heart muscle. When the muscle gets shocked, it squeezes (contracts).

An **ECG (Electrocardiogram)** is basically us putting little electrical microphones (electrodes) on a person's chest to "listen" to those electrical sparks. 

### The Shape of a Heartbeat: P, QRS, and T
When we look at one single heartbeat on an electrical graph, it doesn't look like a single square block. It has a very specific shape with three main bumps. Doctors named these bumps with letters of the alphabet because they lacked imagination: **P, QRS, and T**.

1. **The P-Wave (The Prep):** The top part of the heart (the atria) gets a small spark and gives a little squeeze to push blood into the bottom part of the heart. On a graph, this looks like a small, gentle bump.
2. **The QRS Complex (The Main Event):** The bottom part of the heart (the ventricles) are massive muscles. They need a **huge** electrical shock to squeeze hard enough to push blood to your entire body (from your head to your toes). Because it's a massive shock, it creates a massive, tall, skinny spike on the graph. This spike is made of three points: Q (a little dip), R (the giant peak), and S (another little dip). Together, they are the **QRS Complex**.
3. **The T-Wave (The Reset):** The heart relaxes and recharges its electricity for the next beat. This looks like another gentle bump.

### Why do we care about the QRS?
Because the QRS is the biggest, sharpest spike in the heartbeat, it is the easiest thing for a computer to find. If you can count the QRS spikes, you can count the heart rate (beats per minute). If you find a QRS, you know exactly when the heart pumped. That's why "QRS Detection" is the holy grail of basic heart monitoring.

---

## Part 2: Signal Processing Basics (For Beginners)

Before we look at the algorithm, we need to know what an ECG "signal" actually is to a computer.

### What is a Signal to a Programmer?
Forget graphs and squiggly lines. To you, an ECG signal is just a really long **1D Array of floats**. That's it. 
`ecg_data = [0.01, 0.02, 0.05, -0.1, 1.5, -0.2, 0.03, ...]`

Every number is a voltage reading taken at a specific moment in time. 

If our "sampling rate" is 200 Hz (Hertz), it means the hospital machine took 200 voltage measurements every single second. So, an array of 200 numbers equals 1 second of real-time heart electrical data.

### The Problem: Noise (Garbage Data)
If the heart's electricity was the only thing our sensors picked up, finding the big QRS spike would be easy. You'd just write `if voltage > 1.0: print("Found a beat!")`. 

But the real world is messy. Our array is full of "noise":
1. **Breathing (Baseline Wander):** When a patient breathes in and out, their chest moves. This makes the entire ECG graph slowly drift up and down like a ship on ocean waves. 
2. **Muscles (EMG noise):** If the patient twitches or moves, their chest muscles create their own electricity, which looks like random jagged spikes.
3. **Power lines (50Hz/60Hz noise):** The lights and wall outlets in the hospital give off a hum of electricity that the sensors accidentally pick up.

To find the QRS, we must filter out the garbage.

---

## Part 3: The Pan-Tompkins Algorithm (Step-by-Step Magic)

In 1985, two researchers named Jiapu Pan and Willis J. Tompkins invented a clever series of math tricks to reliably find the QRS complex, even if the signal was garbage. 

Their algorithm is like a factory assembly line. You feed the raw, messy ECG array into the start of the factory, and it goes through 5 machines. Out the other side comes a clean signal that makes finding the heartbeat foolproof.

Here are the 5 steps, explained for a 5-year-old:

### Step 1: The Bandpass Filter (The Bouncers at the Club)
**The Goal:** Get rid of the slow breathing waves and the fast muscle twitches. 
**The Concept:** A "bandpass" filter only lets a specific "band" (range) of speeds pass through. The QRS spike goes up and down at a very specific speed (frequency). Pan and Tompkins figured out that the QRS energy is mostly between 5 Hz and 15 Hz. 
*   They put a bouncer at the door that says: "If you are too slow (under 5 Hz, like breathing), you can't come in." (This is a High-Pass Filter).
*   They put another bouncer that says: "If you are too fast (over 15 Hz, like powerline hum or muscle twitches), you can't come in." (This is a Low-Pass Filter).
**The Result:** The signal is now much flatter, and the QRS spikes stand out a bit more.

### Step 2: The Derivative (The Speedometer)
**The Goal:** Find things that go up and down really steeply.
**The Concept:** In math, a derivative just means "how fast is this thing changing?" 
Remember, the QRS is a sharp spike. It goes from 0 to 100 instantly. The P-wave and T-wave are gentle hills. If we check the *speed* of the changes, the QRS will show up as a massive speed bump, while the gentle hills will barely register. 
In code, taking a derivative is basically just subtracting the previous number in the array from the current number: `speed = array[i] - array[i-1]`.
**The Result:** Gentle bumps (P and T waves) are flattened out. The steep QRS spike is now the loudest thing in the array.

### Step 3: Squaring the Signal (The Magnifying Glass)
**The Goal:** Make all numbers positive, and make big numbers bigger.
**The Concept:** The QRS spike goes *up* (positive) and then sharply *down* (negative). We don't care about direction; we just care that a big event happened. 
If we take every number in our array and multiply it by itself (square it, $x^2$):
*   A negative number becomes positive (`-5 * -5 = +25`). Now the whole signal is above zero.
*   Small noise numbers get smaller (`0.1 * 0.1 = 0.01`).
*   Big QRS numbers get massive (`10 * 10 = 100`).
**The Result:** We've basically put a magnifying glass over the QRS complex and shrunk the noise.

### Step 4: Moving Window Integration (The Smoother)
**The Goal:** Turn the jagged, pointy QRS spike into one solid, smooth hill.
**The Concept:** Right now, our QRS looks like a few jagged needles grouped together. A computer might accidentally count one heartbeat as three separate beats because of the multiple needles.
"Moving Integration" is a fancy way of saying "Moving Average." 
Imagine taking a sliding window of, say, 30 array items. You add them all up, spit out the sum, and slide the window over by one. 
When the window slides over the noisy empty space, the sum is tiny. When the window slides over the cluster of QRS needles, the sum balloons up into one giant, smooth hill.
**The Result:** Every heartbeat is now represented by exactly ONE smooth, giant mountain.

### Step 5: Adaptive Thresholding (The Smart Decision Maker)
**The Goal:** Draw a line and say "Anything taller than this line is a heartbeat."
**The Concept:** You might think we can just say "If the mountain is taller than 100, it's a heartbeat." But what if the patient has a weak heart, and their mountains only reach 50? Or what if they are sweaty, making the signal huge? 
Pan and Tompkins made the threshold *adaptive*. The computer looks at the heights of the last few heartbeats it found. 
*   If the last few beats were 100 units tall, it sets the line at 50.
*   If the signal gets weaker and the beats drop to 40 units tall, the computer notices and lowers the line to 20. 
It learns as it goes!

---

## Part 4: Python Implementation Map

Okay, let's turn this theory into actual Python code. You will need two main libraries: `numpy` (for arrays) and `scipy` (for the math filters). 

*If you don't have them, `pip install numpy scipy matplotlib`.*

### The Setup
```python
import numpy as np
import scipy.signal as signal
import matplotlib.pyplot as plt

# Let's pretend 'ecg' is our 1D numpy array of raw data, and 'fs' is the sampling rate (e.g., 200 Hz).
```

### 1. Bandpass Filter
We will create a filter that only lets through 5 Hz to 15 Hz. Scipy makes this easy using a "Butterworth" filter.
```python
def bandpass_filter(data, fs):
    # Nyquist frequency is half the sampling rate
    nyq = 0.5 * fs 
    low = 5.0 / nyq
    high = 15.0 / nyq
    
    # Create the filter (b, a are the mathematical coefficients)
    b, a = signal.butter(1, [low, high], btype='band')
    
    # Apply the filter to the data
    filtered_data = signal.lfilter(b, a, data)
    return filtered_data
```

### 2. Derivative
We just calculate the difference between adjacent points. We use numpy's `gradient` or `diff`. Pan-Tompkins uses a specific 5-point formula, but for a modern implementation, `np.gradient` works perfectly to find the slope.
```python
def derivative(data):
    # np.gradient calculates the slope at each point
    return np.gradient(data)
```

### 3. Squaring
This is the easiest step in Python!
```python
def squaring(data):
    # Just multiply the array by itself
    return data ** 2
```

### 4. Moving Window Integration
We want a sliding window. The size of the window should be about 0.15 seconds (150 milliseconds) long, because that's roughly how wide a QRS complex is in time.
```python
def moving_window_integration(data, fs):
    # Calculate window size in array indices
    window_time = 0.150 # 150 milliseconds
    window_size = int(window_time * fs)
    
    # A trick to do a moving average: convolve with an array of ones
    window = np.ones(window_size) / window_size
    integrated_data = np.convolve(data, window, mode='same')
    
    return integrated_data
```

### 5. Bringing it all together (The Pipeline)
```python
def pan_tompkins_pipeline(raw_ecg, fs):
    # Step 1
    filtered = bandpass_filter(raw_ecg, fs)
    # Step 2
    derived = derivative(filtered)
    # Step 3
    squared = squaring(derived)
    # Step 4
    integrated = moving_window_integration(squared, fs)
    
    return integrated
```

### 6. The Thresholding (Finding the peaks)
Instead of writing a complex learning algorithm from scratch, we can use Scipy's built-in peak finder on our beautiful, smooth `integrated` signal. Since our signal is now perfect mountains, this is easy.
```python
def find_qrs_peaks(integrated_signal, fs):
    # We expect a heartbeat at most every ~0.2 seconds (300 BPM max)
    min_distance = int(0.2 * fs)
    
    # We calculate the mean of the signal to use as a baseline threshold
    threshold = np.mean(integrated_signal) * 1.5 
    
    # Find the peaks!
    peaks, _ = signal.find_peaks(integrated_signal, distance=min_distance, height=threshold)
    
    return peaks # This returns the array indices where the heartbeats occurred!
```

---

## Summary for your CSE Brain

1. **Biology:** The heart is an electrical pump. The QRS complex is the biggest electrical spike, telling us the main pump squeezed.
2. **Signals:** An ECG is just a 1D array of floats. It has noise (garbage data) from breathing and muscles.
3. **Pan-Tompkins Algorithm:** 
    *   *Bandpass:* Throws out data that is too fast or too slow.
    *   *Derivative:* Highlights the steep drops/climbs of the signal.
    *   *Square:* Makes it positive and magnifies the big spikes.
    *   *Moving Integration:* Smooths the jagged spikes into distinct, countable mountains.
    *   *Threshold:* Detects the mountains.

You now know more about QRS detection than 99% of the world. Good luck with your project! You've got this.
