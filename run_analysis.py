import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
django.setup()

# Now run the analysis
exec(open('backend/scripts/analyze_promo_duplicates_from_db.py').read())
