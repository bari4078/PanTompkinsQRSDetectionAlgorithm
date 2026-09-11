"""
QRS Delineation / Morphological Landmark Estimation Package
============================================================

An independent morphology-analysis layer downstream of the Pan-Tompkins QRS detector.
NOTE: Delineation of individual Q, R, and S waves as well as QRS onset and offset
is an application-specific post-processing feature and was NOT part of the original
1985 Pan-Tompkins QRS detection algorithm.
"""

from .qrs_delineator import QRSDelineator

__all__ = ["QRSDelineator"]
