#!/usr/bin/env python
"""
Wrapper to run the promo analysis directly
"""
import os
import sys
import django

# Add backend to path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

# Import and run the analysis function
try:
    from scripts.analyze_promo_duplicates_from_db import run
    run()
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
