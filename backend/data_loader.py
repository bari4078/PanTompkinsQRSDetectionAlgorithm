import wfdb
import os
import numpy as np

class DataLoader:
    """
    DataLoader is responsible for fetching and loading ECG data
    from the MIT-BIH Arrhythmia Database using the wfdb library.
    """
    def __init__(self, data_dir=None):
        """
        Initializes the loader. Creates a data directory if it doesn't exist.
        """
        if data_dir is None:
            module_dir = os.path.dirname(os.path.abspath(__file__))
            data_dir = os.path.join(module_dir, 'mitbih_data')
        elif not os.path.isabs(data_dir):
            module_dir = os.path.dirname(os.path.abspath(__file__))
            alt_dir = os.path.join(module_dir, data_dir)
            if os.path.exists(alt_dir) and not os.path.exists(os.path.join(data_dir, '100.dat')):
                data_dir = alt_dir
        self.data_dir = data_dir
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

    def download_and_load(self, record_name='100'):
        """
        Downloads a record if it does not exist locally, and loads its signals.

        Args:
            record_name (str): The name of the record (e.g., '100', '101')
        Returns:
            signal (np.array): 1D array of the first ECG lead (usually MLII)
            fs (int): Sampling frequency
        """
        record_path = os.path.join(self.data_dir, record_name)

        # Download from 'mitdb' if we don't have it locally
        if not os.path.exists(record_path + '.dat'):
            print(f"Downloading record {record_name} from PhysioNet...")
            wfdb.dl_database('mitdb', self.data_dir, records=[record_name])

        # Read the record using wfdb
        record = wfdb.rdrecord(record_path)

        # Extract the signal.
        # record.p_signal is a 2D numpy array where columns are different leads.
        # We take the first column (index 0) which is usually the MLII lead.
        signal = record.p_signal[:, 0]

        # The sampling frequency of the recording
        fs = record.fs

        return signal, fs

    def get_available_records(self):
        """
        Returns a hardcoded list of common MIT-BIH records.
        This provides options for the user in the UI dropdown.
        Returns a list of available MIT-BIH records dynamically discovered
        from the local data directory, supplemented with common MIT-BIH record IDs.
        """
        return ['100', '101', '103', '105', '111', '113', '117', '119', '121',
                '200', '201', '205', '212', '213', '219', '222', '230']
        discovered = set()
        if os.path.exists(self.data_dir):
            for fname in os.listdir(self.data_dir):
                if fname.endswith('.dat') or fname.endswith('.hea') or fname.endswith('.atr'):
                    base = os.path.splitext(fname)[0]
                    # Valid MIT-BIH record names are numeric (e.g., '100', '201')
                    if base.isdigit():
                        discovered.add(base)

        default_records = [
            '100', '101', '103', '105', '111', '113', '117', '119', '121',
            '200', '201', '205', '212', '213', '219', '222', '230'
        ]
        all_records = sorted(list(discovered.union(default_records)), key=lambda x: int(x) if x.isdigit() else x)
        return all_records

    def load_record_and_annotations(self, record_name='100', sampto=None):
        """
        Loads ECG signal, sampling frequency, and reference annotations for a record.
        Ensures local availability via PhysioNet download if missing.

        Args:
            record_name (str): The name of the record (e.g. '100', '119')
            sampto (int, optional): Maximum sample index to load

        Returns:
            signal (np.ndarray): 1D array of the lead 0 ECG signal
            fs (int): Sampling frequency
            annotation (wfdb.Annotation): Reference annotation object containing sample and symbol arrays
        """
        record_path = os.path.join(self.data_dir, record_name)

        # Download from 'mitdb' if .dat, .hea, or .atr is missing locally
        if not (os.path.exists(record_path + '.dat') and os.path.exists(record_path + '.atr')):
            print(f"Downloading record {record_name} and annotations from PhysioNet...")
            wfdb.dl_database('mitdb', self.data_dir, records=[record_name])

        # Read the record
        record = wfdb.rdrecord(record_path, sampto=sampto)
        signal = record.p_signal[:, 0]
        fs = record.fs

        # Read the reference annotation
        annotation = wfdb.rdann(record_path, 'atr', sampfrom=0, sampto=sampto)

        return signal, fs, annotation
