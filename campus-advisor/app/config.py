"""Runtime configuration for the assessment-only application."""
import os

HAIWEN_ASSESSMENT_URL = os.environ.get(
    "HAIWEN_ASSESSMENT_URL", "http://127.0.0.1:3011/api/assessment"
)
