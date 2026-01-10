import os
import traceback

def main():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    src_path = os.path.join(base_dir, "jobs", "models.py")
    out_dir = os.path.join(base_dir, "tmp")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "models_compile_err.txt")

    try:
        with open(src_path, "r", encoding="utf-8") as f:
            src = f.read()
        compile(src, src_path, "exec")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("OK\n")
        print(out_path)
    except SyntaxError as e:
        try:
            lines = src.splitlines()
        except Exception:
            lines = []
        lineno = getattr(e, "lineno", None) or 0
        offset = getattr(e, "offset", None)
        start = max(0, lineno - 6)
        end = min(len(lines), lineno + 4)
        snippet = "\n".join(f"{i+1:06d}: {lines[i]}" for i in range(start, end) if 0 <= i < len(lines))
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(f"{type(e).__name__}: {e}\n")
            f.write(f"File: {src_path}\nLine: {lineno}, Offset: {offset}\n")
            f.write("Context:\n")
            f.write(snippet + "\n")
        print(out_path)
    except Exception as e:
        with open(out_path, "w", encoding="utf-8") as f:
            f.write("".join(traceback.format_exception(e)))
        print(out_path)

if __name__ == "__main__":
    main()
