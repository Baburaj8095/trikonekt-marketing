import sys
import os
from pathlib import Path

def extract_with_pymupdf(pdf_path: str) -> str:
    import fitz  # PyMuPDF
    text_parts = []
    with fitz.open(pdf_path) as doc:
        for page in doc:
            # Try standard text extraction
            t = page.get_text("text") or ""
            if not t.strip():
                # Fallback: extract block text if standard is empty
                try:
                    blocks = page.get_text("blocks")
                    if isinstance(blocks, list):
                        t = "\n".join(
                            blk[4] for blk in blocks
                            if isinstance(blk, (list, tuple)) and len(blk) > 4 and isinstance(blk[4], str)
                        )
                except Exception:
                    pass
            text_parts.append(t)
    return "\n\n".join(text_parts).strip()

def extract_with_pdfminer(pdf_path: str) -> str:
    from pdfminer.high_level import extract_text
    return (extract_text(pdf_path) or "").strip()

def main():
    if len(sys.argv) < 3:
        print("Usage: extract_pdf_text.py <input_pdf_path> <output_txt_path>")
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_txt = sys.argv[2]

    os.makedirs(os.path.dirname(output_txt), exist_ok=True)

    text = ""
    method_used = None
    err_msgs = []

    # Attempt PyMuPDF first
    try:
        text = extract_with_pymupdf(input_pdf)
        method_used = "PyMuPDF"
    except Exception as e:
        err_msgs.append(f"PyMuPDF error: {e}")

    # Fallback to pdfminer.six if empty or failed
    if not text.strip():
        try:
            text = extract_with_pdfminer(input_pdf)
            method_used = "pdfminer.six"
        except Exception as e:
            err_msgs.append(f"pdfminer.six error: {e}")

    # Write output (may be empty if PDF has no extractable text)
    with open(output_txt, "w", encoding="utf-8") as f:
        f.write(text)

    # Also write a small meta file to indicate which method was used and any errors
    meta_path = Path(output_txt).with_suffix(".meta.txt")
    with open(meta_path, "w", encoding="utf-8") as mf:
        mf.write(f"input: {input_pdf}\n")
        mf.write(f"output: {output_txt}\n")
        mf.write(f"method_used: {method_used}\n")
        mf.write(f"text_length: {len(text)}\n")
        if err_msgs:
            mf.write("errors:\n")
            for em in err_msgs:
                mf.write(f"  - {em}\n")

if __name__ == "__main__":
    main()
