import os, zipfile, fnmatch, sys
root = r"C:\Users\1\OneDrive\Desktop\IKAI-synthetic-data-generation-and-anonymization"
out = os.path.join(os.path.dirname(root), "IKAI-synthetic-data-generation-and-anonymization-deploy.zip")
exclude_dirs = {'.git', '.venv', '.vscode', '__pycache__', 'node_modules', 'build', 'dist', '.pytest_cache', 'caches', 'cache', '.cache', 'logs', 'tmp', 'temp', 'venv'}
exclude_path_subs = ["static/pseudonym_maps", "pseudonym_maps"]
exclude_file_patterns = ['*.pyc','*.pyo','*.pyd','*.log','*.tmp','*.cache','*.DS_Store','Thumbs.db']
count = 0
# Ensure existing zip is removed
try:
    if os.path.exists(out):
        os.remove(out)
except Exception:
    pass
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root)
        if rel_dir == '.':
            rel_dir = ''
        # Filter out excluded directories anywhere in path
        new_dirnames = []
        for d in dirnames:
            candidate_rel = os.path.join(rel_dir, d).replace('\\','/')
            if any(part in candidate_rel.split('/') for part in exclude_dirs):
                continue
            if any(sub in candidate_rel for sub in exclude_path_subs):
                continue
            new_dirnames.append(d)
        dirnames[:] = new_dirnames
        for f in filenames:
            fp = os.path.join(dirpath, f)
            rel = os.path.relpath(fp, root).replace('\\','/')
            if any(fnmatch.fnmatch(f, pat) for pat in exclude_file_patterns):
                continue
            if any(sub in rel for sub in exclude_path_subs):
                continue
            if any(part in rel.split('/') for part in exclude_dirs):
                continue
            z.write(fp, rel)
            count += 1
# Print results: path, count, size
print(out)
print(count)
print(os.path.getsize(out))
