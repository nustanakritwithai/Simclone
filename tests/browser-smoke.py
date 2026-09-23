"""Compatibility entry point; the current presentation fixture lives in ui-smoke.py."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('ui-smoke.py')),run_name='__main__')
