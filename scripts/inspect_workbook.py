"""Read an XLSX source without executing workbook content or modifying it."""
import hashlib
import json
import posixpath
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS = {"s": MAIN}


def inspect(path):
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        shared = []
        if "xl/sharedStrings.xml" in names:
            for item in ET.fromstring(archive.read("xl/sharedStrings.xml")):
                shared.append("".join(item.itertext()))
        relationships = {
            item.attrib["Id"]: item.attrib["Target"]
            for item in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        }
        sheets = []
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        for sheet in workbook.find("s:sheets", NS):
            target = relationships[sheet.attrib[f"{{{REL}}}id"]]
            target = target.lstrip("/") if target.startswith("/") else posixpath.normpath("xl/" + target)
            root = ET.fromstring(archive.read(target))
            cells = []
            for cell in root.findall(".//s:sheetData/s:row/s:c", NS):
                kind = cell.attrib.get("t", "n")
                value = cell.findtext("s:v", default="", namespaces=NS)
                if kind == "s":
                    value = shared[int(value)] if value else ""
                elif kind == "inlineStr":
                    value = "".join(cell.find("s:is", NS).itertext())
                formula = cell.findtext("s:f", namespaces=NS)
                if value != "" or formula:
                    entry = {"cell": cell.attrib["r"], "value": value, "type": kind}
                    if formula:
                        entry["formula"] = formula
                    cells.append(entry)
            sheets.append({
                "name": sheet.attrib["name"],
                "state": sheet.attrib.get("state", "visible"),
                "dimension": root.find("s:dimension", NS).attrib.get("ref") if root.find("s:dimension", NS) is not None else None,
                "cells": cells,
                "mergedRanges": [item.attrib["ref"] for item in root.findall("s:mergeCells/s:mergeCell", NS)],
            })
        return {
            "source": path.name,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "sheets": sheets,
            "externalLinks": [name for name in names if name.startswith("xl/externalLinks/")],
        }


if __name__ == "__main__":
    source = Path(sys.argv[1])
    result = inspect(source)
    output = Path(sys.argv[2])
    output.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    for sheet in result["sheets"]:
        print(f"SHEET: {sheet['name']} ({sheet['dimension']}, {sheet['state']})")
        for cell in sheet["cells"]:
            print(f"{cell['cell']}: {cell['value']}")
