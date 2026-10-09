import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

script_content = """
from locations.models import State
for s in State.objects.filter(name__icontains='goa'):
    print('Goa:', s.id, s.name)
for s in State.objects.filter(name__icontains='karnataka'):
    print('Karnataka:', s.id, s.name)
"""

if __name__ == "__main__":
    run_remote(script_content)
