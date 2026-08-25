import numpy as np

def analyze_ecg(r_peaks, fs):
    """
    Analyzes the detected R-peaks to compute HR, HRV, and detect abnormalities.
    This provides the 'impressive' medical insights requested.
    
    Args:
        r_peaks (list): List of indices where R-peaks occur in the signal.
        fs (int): Sampling frequency of the signal.
        
    Returns:
        dict: Dictionary containing analysis metrics, abnormalities, and BP estimation.
    """
    if len(r_peaks) < 2:
        return {
            "hr_bpm": 0,
            "rmssd_ms": 0,
            "sdnn_ms": 0,
            "abnormalities": ["Not enough peaks detected for analysis."],
            "simulated_bp": "N/A",
            "rr_intervals_ms": []
        }
        
    # Calculate RR intervals (distance between consecutive R-peaks)
    # np.diff computes the difference between consecutive elements
    rr_intervals_samples = np.diff(r_peaks)
    
    # Convert samples to seconds
    rr_intervals_sec = rr_intervals_samples / fs
    
    # 1. Heart Rate (HR) in Beats Per Minute (BPM)
    mean_rr_sec = np.mean(rr_intervals_sec)
    hr_bpm = 60.0 / mean_rr_sec if mean_rr_sec > 0 else 0
    
    # 2. Heart Rate Variability (HRV) - Time Domain Metrics
    # RMSSD: Root Mean Square of Successive Differences. A key measure of parasympathetic activity.
    diff_rr = np.diff(rr_intervals_sec)
    if len(diff_rr) > 0:
        rmssd = np.sqrt(np.mean(diff_rr ** 2)) * 1000  # Convert to ms
    else:
        rmssd = 0
        
    # SDNN: Standard Deviation of NN (RR) intervals. Reflects overall autonomic nervous system activity.
    sdnn = np.std(rr_intervals_sec) * 1000 # Convert to ms
    
    # 3. Abnormality Detection
    abnormalities = []
    
    # Bradycardia: Resting HR < 60 bpm
    if hr_bpm < 60:
        abnormalities.append("Bradycardia Detected (Low Heart Rate < 60 bpm)")
        
    # Tachycardia: Resting HR > 100 bpm
    if hr_bpm > 100:
        abnormalities.append("Tachycardia Detected (High Heart Rate > 100 bpm)")
        
    # Irregular Rhythm: High variance in RR intervals
    # A simple threshold for irregularity. SDNN > 100ms indicates high variability, possibly irregular rhythm.
    if sdnn > 100: 
        abnormalities.append("Highly Irregular Rhythm Detected (High SDNN)")
        
    if not abnormalities:
        abnormalities.append("Normal Sinus Rhythm")
        
    # 4. Simulated Blood Pressure Estimation
    # NOTE: True BP cannot be accurately measured from a single-lead ECG without a PPG signal
    # (Pulse Transit Time). We provide a simulated/estimated value based on a basic heuristic 
    # to fulfill the user's UI request, while explicitly acknowledging it's an estimation.
    # Heuristic: Higher HR weakly correlates with higher BP during physical stress.
    simulated_systolic = 110 + (hr_bpm - 70) * 0.5
    simulated_diastolic = 70 + (hr_bpm - 70) * 0.3
    
    # Keep within normal realistic bounds for realism
    simulated_systolic = min(max(simulated_systolic, 90), 180)
    simulated_diastolic = min(max(simulated_diastolic, 60), 120)

    return {
        "hr_bpm": round(hr_bpm, 1),
        "rmssd_ms": round(rmssd, 1),
        "sdnn_ms": round(sdnn, 1),
        "abnormalities": abnormalities,
        "simulated_bp": f"{int(simulated_systolic)}/{int(simulated_diastolic)} mmHg (Est.)",
        "rr_intervals_ms": (rr_intervals_sec * 1000).tolist()
    }
