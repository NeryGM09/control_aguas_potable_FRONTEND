from __future__ import annotations

from pathlib import Path
import re
import sys


def apply_patch(path: str, pattern: str, replacement: str, already: str, label: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")

    if re.search(already, text, flags=re.M):
        print(f"[skip] {label}")
        return

    new_text, count = re.subn(pattern, replacement, text, count=1, flags=re.M)
    if count == 0:
        raise SystemExit(f"Pattern not found for {label} in {file_path}")

    file_path.write_text(new_text, encoding="utf-8")
    print(f"[ok] {label}")


def main() -> None:
    catv_path = r"C:\Users\Dell G15\Desktop\API_CATV_3.0\backend\controllers\control_aguas\sap_ptap.py"
    sap_path = r"C:\Users\Dell G15\API_SAP\includes\sap.py"

    apply_patch(
        catv_path,
        r'(?m)^(?P<indent>\s*)"TURB_AGUA_TRATADA",\s*$\r?\n(?P=indent)"OBSERVACIONES",\s*$',
        r'\g<indent>"TURB_AGUA_TRATADA",\n\g<indent>"CLORO",\n\g<indent>"OBSERVACIONES",',
        r'(?m)^(?P<indent>\s*)"TURB_AGUA_TRATADA",\s*$\r?\n(?P=indent)"CLORO",\s*$\r?\n(?P=indent)"OBSERVACIONES",\s*$',
        "API_CATV PTAP_FIELDS",
    )
    apply_patch(
        catv_path,
        r'(?m)^(?P<indent>\s*)"TURB_AGUA_TRATADA": _coerce_decimal\(_get_value\(tratada, "turbidez"\)\),\s*$',
        r'\g<indent>"TURB_AGUA_TRATADA": _coerce_decimal(_get_value(tratada, "turbidez")),\n\g<indent>"CLORO": _coerce_decimal(_get_value(tratada, "cloro")),',
        r'(?m)^(?P<indent>\s*)"CLORO": _coerce_decimal\(_get_value\(tratada, "cloro"\)\),\s*$',
        "API_CATV payload",
    )

    apply_patch(
        sap_path,
        r'(?m)^(?P<indent>\s*)"TURB_AGUA_TRATADA",\s*$\r?\n(?P=indent)"OBSERVACIONES",\s*$',
        r'\g<indent>"TURB_AGUA_TRATADA",\n\g<indent>"CLORO",\n\g<indent>"OBSERVACIONES",',
        r'(?m)^(?P<indent>\s*)"TURB_AGUA_TRATADA",\s*$\r?\n(?P=indent)"CLORO",\s*$\r?\n(?P=indent)"OBSERVACIONES",\s*$',
        "API_SAP extra_keys",
    )
    apply_patch(
        sap_path,
        r'(?m)^(?P<indent>\s*)"TURB_AGUA_TRATADA",\s*$\r?\n(?P<close>\s*)}\s*$',
        r'\g<indent>"TURB_AGUA_TRATADA",\n\g<indent>"CLORO",\n\g<close>}',
        r'(?m)^(?P<indent>\s*)"TURB_AGUA_TRATADA",\s*$\r?\n(?P=indent)"CLORO",\s*$\r?\n(?P<close>\s*)}\s*$',
        "API_SAP decimal_keys",
    )


if __name__ == "__main__":
    main()
