from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from data_loader import DataLoader
from pan_tompkins.detector import PanTompkinsDetector
from delineation.qrs_delineator import QRSDelineator
from analysis import analyze_ecg

app = FastAPI(title="Pan-Tompkins API", description="API for ECG Processing and Analysis")

# Enable CORS (Cross-Origin Resource Sharing)
# This allows our React frontend (running on a different port) to communicate with this backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

data_loader = DataLoader()

# Define the expected structure of incoming JSON requests using Pydantic
class ProcessRequest(BaseModel):
    record_id: str
    window_size_ms: int = 150
    lowcut: float = 5.0
    highcut: float = 15.0

@app.get("/api/records")
def get_records():
    """Returns a list of available MIT-BIH record IDs."""
    return {"records": data_loader.get_available_records()}

@app.post("/api/process")
def process_record(req: ProcessRequest):
    """
    Fetches the requested record, processes it through the Pan-Tompkins algorithm,
    and returns the signals and analysis metrics.
    """
    try:
        # 1. Load data
        signal, fs = data_loader.download_and_load(req.record_id)

        # Limit to the first 10 seconds for fast UI responsiveness and clear visualization.
        # Plotting 30 minutes of data at 360Hz would crash the browser.
        duration_sec = 10
        signal = signal[:int(fs * duration_sec)]

        # 2. Initialize the detector with dynamic parameters from the UI
        detector = PanTompkinsDetector(
            window_size_ms=req.window_size_ms,
            filter_lowcut=req.lowcut,
            filter_highcut=req.highcut
        )

        # 3. Process the signal
        stages = detector.process(signal, fs)

        # 4. QRS Delineation / Morphological Landmark Estimation
        # NOTE: Delineation of individual Q, R, S waves, and QRS onset/offset is an
        # application-specific downstream morphology layer and NOT part of the original
        # 1985 Pan-Tompkins algorithm.
        delineator = QRSDelineator()
        delineation = delineator.delineate_beats(
            signal=signal,
            fs=fs,
            qrs_indices=stages['peaks_original'],
            detection_metadata=stages
        )
        stages['delineation'] = delineation

        # 5. Analyze the detected peaks for advanced metrics
        analysis = analyze_ecg(stages['peaks_original'], fs)

        # Return everything as JSON
        metadata = {
            "detected_peaks": stages["detected_peaks"],
            "detection_method": stages["detection_method"],
            "searchback": stages["searchback"],
            "rr_intervals": stages["rr_intervals"],
            "rr_average_1": stages["rr_average_1"],
            "rr_average_2": stages["rr_average_2"],
            "spki": stages["spki"],
            "npki": stages["npki"],
            "spkf": stages["spkf"],
            "npkf": stages["npkf"],
            "threshold_i1": stages["threshold_i1"],
            "threshold_i2": stages["threshold_i2"],
            "threshold_f1": stages["threshold_f1"],
            "threshold_f2": stages["threshold_f2"],
            "refractory_intervals": stages["refractory_intervals"],
            "rejected_t_waves": stages["rejected_t_waves"]
        }
        return {
            "fs": fs,
            "stages": stages,
            "analysis": analysis,
            "metadata": metadata,
            "delineation": delineation
        }
    except Exception as e:
        # Return a 500 Internal Server Error if something goes wrong (e.g. invalid record)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Run the server when this script is executed directly
    uvicorn.run(app, host="127.0.0.1", port=8000)
