import re

file_path = r"frontend\src\pages\team\TeamDashboard.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Locate the block from "function SPPMonthlyCadenceWidget()" to end of CycleBulkCoursePurchaseModal
pattern = r"(function SPPMonthlyCadenceWidget\(\) \{[\s\S]*?\}\n\}\n)"
match = re.search(pattern, content)

if not match:
    print("Could not match the widgets block with regex, searching by markers...")
    start_marker = "function SPPMonthlyCadenceWidget() {"
    end_marker = "}\n\n  const [searchTerm, setSearchTerm] = useState(\"\");"
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker) + 1  # include the closing brace
    if start_idx != -1 and end_idx != -1:
        widget_code = content[start_idx:end_idx]
        print(f"Found widget code block of length {len(widget_code)}")
    else:
        print("ERROR: Markers not found!")
        exit(1)
else:
    widget_code = match.group(1).rstrip()
    start_idx = match.start()
    end_idx = match.end()

# Remove the widget code from inside TeamDashboard
cleaned_content = content[:start_idx] + content[end_idx:]

# Find where "export default function TeamDashboard() {" is
target_marker = "export default function TeamDashboard() {"
insert_idx = cleaned_content.find(target_marker)

if insert_idx == -1:
    print("ERROR: target marker not found!")
    exit(1)

# Also find where "const [searchTerm, setSearchTerm] = useState("");" is inside TeamDashboard
# and move it to near "const [profileUser, setProfileUser] = useState(storedUser);"
search_term_marker = '  const [searchTerm, setSearchTerm] = useState("");\n  const [activeCategory, setActiveCategory] = useState("ALL");\n'
if search_term_marker in cleaned_content:
    cleaned_content = cleaned_content.replace(search_term_marker, "")
    hook_insert_marker = '  const [profileUser, setProfileUser] = useState(storedUser);'
    hook_replacement = '  const [profileUser, setProfileUser] = useState(storedUser);\n  const [searchTerm, setSearchTerm] = useState("");\n  const [activeCategory, setActiveCategory] = useState("ALL");'
    cleaned_content = cleaned_content.replace(hook_insert_marker, hook_replacement, 1)

new_content = cleaned_content[:insert_idx] + widget_code + "\n\n" + cleaned_content[insert_idx:]

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Successfully refactored TeamDashboard.jsx! Subcomponents moved to file scope.")
