from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import os
    from io import BytesIO

import sys
import copy
import os
import zipfile
from contextlib import suppress
from dataclasses import dataclass
from io import BytesIO
from operator import attrgetter
from pathlib import Path
from typing import TYPE_CHECKING, List
from warnings import warn

from lxml import etree
from typing_extensions import Self

from docx2python import depth_collector
from docx2python.attribute_register import XML2HTML_FORMATTER
from docx2python.docx_context import collect_numFmts, collect_rels
from docx2python.docx_text import get_file_content, new_depth_collector
from docx2python.merge_runs import merge_elems

if TYPE_CHECKING:
    from io import BytesIO
    from types import TracebackType

    from lxml.etree import _Element as EtreeElement  # type: ignore

    from docx2python.depth_collector import DepthCollector

CONTENT_FILE_TYPES = {"officeDocument", "header", "footer", "footnotes", "endnotes"}

from dataclasses import dataclass
from typing import TYPE_CHECKING, List, cast
from warnings import warn

from typing_extensions import Self

from docx2python.depth_collector import get_par_strings
from docx2python.docx_context import collect_docProps
from docx2python.docx_text import flatten_text, new_depth_collector
from docx2python.iterators import enum_at_depth, get_html_map, iter_at_depth
from docx2python.namespace import get_attrib_by_qn

if TYPE_CHECKING:
    import os
    from types import TracebackType

    from docx2python.depth_collector import Par
    from docx2python.docx_reader import DocxReader

    ParsTable = List[List[List[List[Par]]]]
    TextTable = List[List[List[List[List[str]]]]]


@dataclass
class File:
    """The attribute dict of a file in the docx, plus cached data.

    The docx lists internal files in various _rels files. Each will be specified with a
    dict of, e.g.::

        {
            'Id': 'rId8',
            'Type': 'http://schemas.openxmlformats.org/.../relationships/header',
            'Target': 'header1.xml'
        }

    This isn't quite enough to infer the structure of the docx. You'll also need to
    know the directory where each attribute dict was found::

        'dir': 'word/_rels'

    That's the starting point for these instances. Other attributes are inferred or
    created at runtime.
    """

    def __init__(self, context: DocxReader, attribute_dict: dict[str, str]) -> None:
        """Point to container DocxContext instance and store attributes as properties.

        :param context: The DocxContent object holding this instance
        :param attribute_dict: Attributes of this file found in the rels, plus 'dir' as
            described above.
        """
        self.context = context
        self.Id = str(attribute_dict["Id"])
        self.Type = Path(attribute_dict["Type"]).name
        self.Target = attribute_dict["Target"]
        self.dir = attribute_dict["dir"]
        # cached_properties
        self.__path: None | str = None
        self.__rels_path: None | str = None
        self.__rels: None | dict[str, str] = None
        self.__root_element: None | EtreeElement = None
        self.__depth_collector: None | DepthCollector = None

    def __repr__(self) -> str:
        """File with self.path.

        :return: String representation
        """
        return f"File({self.path})"

    @property
    def path(self) -> str:
        """Infer path/to/xml/file from instance attributes.

        :return: path to xml file

        This will take the information in a file specification (from one of the rels
        files, e.g., {Id:'  ', Type:'  ' Target:'  ', dir:'  '}) and infer a path to
        the specified xml file.

        E.g.,
        from     self.dir = '_rels'       self.Target = 'word/document.xml
                    dirname ''          +       dirname 'word/'
                                        +       filename =   'document.xml'
        return `word/document`

        E.g.,
        from     self.dir = 'word/_rels'       self.Target = 'header1.xml
                    dirname 'word'      +            dirname ''
                                        +       filename =   'header1.xml'
        return `word/header1.xml`
        """
        if self.__path is not None:
            return self.__path

        dirs = [Path(x).parent.name for x in (self.dir, self.Target)]
        dirname = "/".join([x for x in set(dirs) if x])
        filename = Path(self.Target).name
        self.__path = f"{dirname}/{filename}"
        return self.__path

    @property
    def _rels_path(self) -> str:
        """Infer path/to/rels from instance attributes.

        :return: path to rels (which may not exist)

        Every content file (``document.xml``, ``header1.xml``, ...) will have its own
        ``.rels`` file--if any relationships are defined.

        The path inferred here may not exist.

        E.g.,
        from     self.dir = '_rels'       self.Target = 'word/document.xml
                    dirname ''          +       dirname 'word/'
                                        +       filename =   'document.xml'
        return `word/_rels/document.xml.rels`

        E.g.,
        from     self.dir = 'word/_rels'       self.Target = 'header1.xml
                    dirname 'word'      +            dirname ''
                                        +       filename =   'header1.xml'
        return `word/_rels/header1.xml.rels`
        """
        if self.__rels_path is not None:
            return self.__rels_path
        dirname, filename = os.path.split(self.path)
        self.__rels_path = "/".join([dirname, "_rels", filename + ".rels"])
        return self.__rels_path

    @property
    def rels(self) -> dict[str, str]:
        """Get rIds mapped to values.

        :return: dict of rIds mapped to values

        Each content file.xml will have a file.xml.rels file--if relationships are
        defined. Inside file.xml, values defined in the file.xml.rels file may be
        referenced by their rId numbers.

        :return: Contents of the file.xml.rels file with reference rId numbers. These
        refer to values defined in the file.xml.rels file:

        E.g.::

        {
            "rId3": "webSettings.xml",
            "rId2": "settings.xml",
            "rId1": "styles.xml",
            "rId6": "theme/theme1.xml",
            "rId5": "fontTable.xml",
            "rId4": "https://www.shayallenhill.com/",
        }

        Not every xml file with have a rels file. Return an empty dictionary if the
        rels file is not found.
        """
        if self.__rels is not None:
            return self.__rels

        try:
            unzipped = self.context.zipf.read(self._rels_path)
            tree = etree.fromstring(unzipped)
            self.__rels = {str(x.attrib["Id"]): str(x.attrib["Target"]) for x in tree}
        except KeyError:
            self.__rels = {}
        return self.__rels

    @property
    def root_element(self) -> EtreeElement:
        """Root element of the file.

        :return: Root element of the file.

        Try to merge consecutive, duplicate (except text) elements in content files.
        See documentation for ``merge_elems``. Warn if ``merge_elems`` fails.
        (I don't think it will fail).
        """
        if self.__root_element is not None:
            return self.__root_element

        root = etree.fromstring(self.context.zipf.read(self.path))
        if self.Type in CONTENT_FILE_TYPES:
            root_ = copy.copy(root)
            try:
                merge_elems(self, root)
            except (TypeError, AttributeError) as ex:
                warn(
                    "Attempt to merge consecutive elements in "
                    + f"{self.context.docx_filename} {self.path} resulted in "
                    + f"{ex!r}. Moving on.",
                    stacklevel=2,
                )
                self.__root_element = root_
        self.__root_element = root
        return self.__root_element

    @property
    def depth_collector(self) -> DepthCollector:
        """DepthCollector instance for this file.

        :return: DepthCollector instance for this file.

        The DepthCollector instance will be used to extract text from the file.
        """
        self.__depth_collector = self.__depth_collector or new_depth_collector(self)
        return self.__depth_collector

    @property
    def content(self) -> ParsTable:
        """Text extracted into a 4-deep nested list of Par instances.

        :return: [[[[Par]]]]
        """
        return self.get_content()

    @property
    def text(self) -> TextTable:
        """Text extracted into a 5-deep list of strings [[[[[str]]]]].

        :return: Text extracted into a nested list of strings [[[[[str]]]]]
        """
        return self.get_text()

    def get_content(self, root: EtreeElement | None = None) -> ParsTable:
        """Return the same content as property 'content' with optional given root.

        :param root: Extract content of file from root down.
            If root is not given, return full content of file.
        :return: Text extracted into [[[[Par]]]]
        """
        if root is None:
            return self.depth_collector.tree
        return get_file_content(self, root)

    def get_text(self, root: EtreeElement | None = None) -> TextTable:
        """Return the same content as property 'text' with optional given root.

        :param root: Extract content of file from root down.
            If root is not given, return full content of file.
        :return: Text extracted into [[[[[str]]]]]
        """
        return depth_collector.get_par_strings(self.get_content(root))


@dataclass
class DocxReader:
    """Hold File instances and decode info shared between them (e.g., numFmts)."""

    def __init__(
        self,
        docx_filename: str | os.PathLike[str] | BytesIO,
        *,
        html: bool = False,
        duplicate_merged_cells: bool = True,
    ) -> None:
        """Initialize DocxReader instance.

        :param docx_filename: Path to docx file, or BytesIO object.
        :param html: If True, convert xml to html.
        :param paragraph_styles: If True, include paragraph styles in html.
        :param duplicate_merged_cells: If True, duplicate text in merged cells.
        """
        self.docx_filename = docx_filename
        self.duplicate_merged_cells = duplicate_merged_cells

        if html:
            self.xml2html_format = XML2HTML_FORMATTER
        else:
            self.xml2html_format = {}

        # cached properties and a flag (__closed)
        self.__zipf: None | zipfile.ZipFile = None
        self.__files: None | list[File] = None
        self.__numId2NumFmts: None | dict[str, list[str]] = None
        self.__closed = False

    @property
    def zipf(self) -> zipfile.ZipFile:
        """Entire docx unzipped into bytes.

        :return: Entire docx unzipped into bytes.
        :raise ValueError: If DocxReader instance has been closed
        """
        if self.__closed:
            msg = "DocxReader instance has been closed."
            raise ValueError(msg)
        if self.__zipf is None:
            self.__zipf = zipfile.ZipFile(self.docx_filename)
            return self.__zipf
        return self.__zipf

    def close(self):
        """Close the zipfile, set __closed flag to True."""
        if self.__zipf is not None and self.__zipf.fp:
            self.__zipf.close()
        self.__closed = True

    def __enter__(self) -> Self:
        """Do nothing. The zipfile will open itself when needed.

        :return: self
        """
        return self

    def __exit__(
        self,
        exc_type: None | type[BaseException],
        exc_value: None | BaseException,
        exc_traceback: None | TracebackType,
    ) -> Self:
        """Close the zipfile.

        :param exc_type: Python internal use
        :param exc_value: Python internal use
        :param exc_traceback: Python internal use
        """
        self.close()
        return self

    @property
    def files(self) -> list[File]:
        """Instantiate a File instance for every content file.

        :return: List of File instances, one per content file.
        """
        if self.__files is not None:
            return self.__files

        files: list[File] = []
        for k, v in collect_rels(self.zipf).items():
            dir_ = str(Path(k).parent)
            files += [File(self, {**x, "dir": dir_}) for x in v]
        self.__files = files
        return self.__files

    @property
    def comments(self) -> list[EtreeElement]:
        """Comments from the document.

        :return: Comments from the document.
        """
        try:
            comment_file = self.file_of_type("comments")
        except KeyError:
            return []
        return list(comment_file.root_element)

    @property
    def numId2numFmts(self) -> dict[str, list[str]]:
        """Return numId referenced in xml to list of numFmt per indentation level.

        :return: numId referenced in xml to list of numFmt per indentation level

        See docstring for collect_numFmts

        Returns an empty dictionary if word/numbering.xml cannot be found.
        Ultimately, this will result in any lists (there should NOT be any lists if
        there is no word/numbering.xml) being "numbered" with "--".
        """
        if self.__numId2NumFmts is not None:
            return self.__numId2NumFmts

        try:
            numFmts_root = etree.fromstring(self.zipf.read("word/numbering.xml"))
            self.__numId2NumFmts = collect_numFmts(numFmts_root)
        except KeyError:
            self.__numId2NumFmts = {}
        return self.__numId2NumFmts

    def file_of_type(self, type_: str) -> File:
        """Return file instance attrib Type='http://.../type_'. Warn if more than one.

        :param type_: this package looks for any of
            ("header", "officeDocument", "footer", "footnotes", "endnotes")
            You can try others.
        :return: File instance of the requested type
        :raise KeyError: if no file of the requested type is found
        """
        files_of_type = self.files_of_type(type_)
        if len(files_of_type) > 1:
            warn(
                "Multiple files of type '{type_}' found. Returning first.", stacklevel=2
            )
        try:
            return files_of_type[0]
        except IndexError as exc:
            raise KeyError(
                f"There is no item of type '{type_}' "
                + "in the {self.docx_filename} archive"
            ) from exc

    def files_of_type(self, type_: str | None = None) -> list[File]:
        """List File instances with attrib Type='http://.../type_'.

        :param type_: this package looks for any of
            ("header", "officeDocument", "footer", "footnotes", "endnotes", "comments")
            You can try others. If argument is None (default), returns all content file
            types.
        :return: File instances of the requested type, sorted by path
        """
        types = CONTENT_FILE_TYPES if type_ is None else {type_}
        return sorted(
            (x for x in self.files if x.Type in types), key=attrgetter("path")
        )

    def content_files(self) -> list[File]:
        """List content files (contain displayed text) inside the docx.

        :return: File instances of context files, sorted by path
        """
        return self.files_of_type()

    def save(self, filename: str | os.PathLike[str]) -> None:
        """Save the (presumably altered) xml.

        :param filename: path to output file (presumably *.docx)

        xml (root_element) attributes are cached, so these can be altered and saved.
        This allows saving a copy of the input docx after the ``merge_elems`` operation.
        Also allows some light editing like search and replace.
        """
        content_files = [x for x in self.files if x.Type in CONTENT_FILE_TYPES]
        with zipfile.ZipFile(f"{filename}", mode="w") as zout:
            _copy_but(self.zipf, zout, {x.path for x in content_files})
            for file in content_files:
                zout.writestr(file.path, etree.tostring(file.root_element))

    def pull_image_files(
        self, image_directory: str | os.PathLike[str] | None = None
    ) -> dict[str, bytes]:
        """Copy images from zip file.

        :param image_directory: optional destination for copied images
        :return: Image names mapped to images in binary format.

            To write these to disc::

                with open(key, 'wb') as file:
                    file.write(value)

        :side effects: Given an optional image_directory, will write the images out
        to file.
        """
        images: dict[str, bytes] = {}
        for image in self.files_of_type("image"):
            with suppress(KeyError):
                images[Path(image.Target).name] = self.zipf.read(image.path)
        if image_directory is not None:
            image_directory = Path(image_directory)
            image_directory.mkdir(parents=True, exist_ok=True)
            for file, image_bytes in images.items():
                with (image_directory / file).open("wb") as image_copy:
                    _ = image_copy.write(image_bytes)
        return images


def _copy_but(
    in_zip: zipfile.ZipFile,
    out_zip: zipfile.ZipFile,
    exclusions: set[str] | None = None,
) -> None:
    """Copy every file in a docx except those listed in exclusions.

    :param in_zip: zipfile of origin xml file
    :param out_zip: zipfile of destination xml file
    :param exclusions: filenames you don't want to copy (e.g., 'document.xml')
    """
    exclusions = exclusions or set()
    for item in in_zip.infolist():
        if item.filename not in exclusions:
            buffer = in_zip.read(item.filename)
            out_zip.writestr(item, buffer)


def docx2python(
    docx_filename: str | os.PathLike[str] | BytesIO,
    image_folder: str | os.PathLike[str] | None = None,
    *,
    html: bool = False,
    duplicate_merged_cells: bool = True,
) -> DocxContent:
    """Unzip a docx file and extract contents.

    :param docx_filename: path to a docx file
    :param image_folder: optionally specify an image folder
        (images in docx will be copied to this folder)
    :param html: bool, extract some formatting as html
    :param duplicate_merged_cells: bool, duplicate merged cells to return a mxn
        nested list for each table (default True)
    :return: DocxContent object
    """
    docx_context = DocxReader(
        docx_filename, html=html, duplicate_merged_cells=duplicate_merged_cells
    )
    docx_content = DocxContent(docx_context, image_folder)
    if image_folder:
        _ = docx_content.images
    return docx_content


def _join_runs(tables: TextTable) -> list[list[list[list[str]]]]:
    """Join the leaves of a 5-deep nested list of strings.

    :param str_tree: a 5-deep nested list of strings [[[[["a", "b"]]]]]
    :return: a 4-deep nexted list of strings [[[["ab"]]]]

    Collapse nested lists of run strings into nested lists of paragraph strings.

    runs = [
        [
            [
                [
                    [
                        "run1", "run2"
                    ],
                    [
                        "run3", "run4"
                    ]
                ]
            ]
        ]
    ]

    `join_runs(runs)` =>

    [
        [
            [
                [
                    "run1run2",
                    "run3run4"
                ]
            ]
        [
    ]
    """
    result: list[list[list[list[str]]]] = []
    for tbl in tables:
        result.append(cast(List[List[List[str]]], []))
        for row in tbl:
            result[-1].append(cast(List[List[str]], []))
            for cell in row:
                result[-1][-1].append(cast(List[str], []))
                for par in cell:
                    result[-1][-1][-1].append("".join(par))
    return result


@dataclass
class DocxContent:
    """Holds return values for docx content."""

    docx_reader: DocxReader
    image_folder: str | os.PathLike[str] | None

    def close(self):
        """Close the zipfile opened by DocxReader."""
        self.docx_reader.close()

    def __enter__(self) -> Self:
        """Do nothing. The zipfile will open itself when needed.

        :return: self
        """
        return self

    def __exit__(
        self,
        exc_type: None | type[BaseException],
        exc_value: None | BaseException,
        exc_traceback: None | TracebackType,
    ) -> None:
        """Close the zipfile opened by DocxReader.

        :param exc_type: Python internal use
        :param exc_value: Python internal use
        :param exc_traceback: Python internal use
        """
        self.close()

    def _get_pars(self, type_: str) -> ParsTable:
        """Get Par instances for an internal document type.

        :param type_: this package looks for any of
            ("header", "officeDocument", "footer", "footnotes", "endnotes")
            You can try others.
        :return: text paragraphs [[[Par]]]
        """
        content: ParsTable = []
        for file in self.docx_reader.files_of_type(type_):
            content += file.content
        return content

    @property
    def header_pars(self) -> ParsTable:
        """Get nested Par instances for header files.

        :return: nested Par instances [[[Par]]]
        """
        return self._get_pars("header")

    @property
    def footer_pars(self) -> ParsTable:
        """Get nested Par instances for footer files.

        :return: nested Par instances [[[Par]]]
        """
        return self._get_pars("footer")

    @property
    def officeDocument_pars(self) -> ParsTable:
        """Get nested Par instances for the main officeDocument file.

        :return: nested Par instances [[[Par]]]
        """
        return self._get_pars("officeDocument")

    @property
    def body_pars(self) -> ParsTable:
        """Get nested Par instances for the main officeDocument file.

        :return: nested Par instances [[[Par]]]

        This is an alias for officeDocument_pars.
        """
        return self.officeDocument_pars

    @property
    def footnotes_pars(self) -> ParsTable:
        """Get nested Par instances for footnotes files.

        :return: nested Par instances [[[Par]]]
        """
        return self._get_pars("footnotes")

    @property
    def endnotes_pars(self) -> ParsTable:
        """Get nested Par instances for endnotes files.

        :return: nested Par instances [[[Par]]]
        """
        return self._get_pars("endnotes")

    @property
    def document_pars(self) -> ParsTable:
        """All docx x_pars properties concatenated.

        :return: nested Par instances [[[Par]]]
        """
        return (
            self.header_pars
            + self.body_pars
            + self.footer_pars
            + self.footnotes_pars
            + self.endnotes_pars
        )

    @property
    def header_runs(self) -> list[list[list[list[list[str]]]]]:
        """Get nested run strings for header files.

        :return: nested run strings [[[[[str]]]]]
        """
        return get_par_strings(self.header_pars)

    @property
    def footer_runs(self) -> list[list[list[list[list[str]]]]]:
        """Get nested run strings for footer files.

        :return: nested run strings [[[[[str]]]]]
        """
        return get_par_strings(self.footer_pars)

    @property
    def officeDocument_runs(self) -> list[list[list[list[list[str]]]]]:
        """Get nested run strings for the main officeDocument file.

        :return: nested run strings [[[[[str]]]]]
        """
        return get_par_strings(self.officeDocument_pars)

    @property
    def body_runs(self) -> list[list[list[list[list[str]]]]]:
        """Get nested run strings for the main officeDocument file.

        :return: nested run strings [[[[[str]]]]]

        This is an alias for officeDocument_runs.
        """
        return self.officeDocument_runs

    @property
    def footnotes_runs(self) -> list[list[list[list[list[str]]]]]:
        """Get nested run strings for footnotes files.

        :return: nested run strings [[[[[str]]]]]
        """
        return get_par_strings(self.footnotes_pars)

    @property
    def endnotes_runs(self) -> list[list[list[list[list[str]]]]]:
        """Get nested run strings for endnotes files.

        :return: nested run strings [[[[[str]]]]]
        """
        return get_par_strings(self.endnotes_pars)

    @property
    def document_runs(self) -> list[list[list[list[list[str]]]]]:
        """All docx x_runs properties concatenated.

        :return: nested run strings [[[[[str]]]]]
        """
        return (
            self.header_runs
            + self.body_runs
            + self.footer_runs
            + self.footnotes_runs
            + self.endnotes_runs
        )

    @property
    def header(self) -> list[list[list[list[str]]]]:
        """Get header text.

        :return: nested paragraphs [[[[str]]]]
        """
        return _join_runs(self.header_runs)

    @property
    def footer(self) -> list[list[list[list[str]]]]:
        """Get footer text.

        :return: nested paragraphs [[[[str]]]]
        """
        return _join_runs(self.footer_runs)

    @property
    def officeDocument(self) -> list[list[list[list[str]]]]:
        """Get officeDocument text.

        :return: nested paragraphs [[[[str]]]]
        """
        return _join_runs(self.officeDocument_runs)

    @property
    def body(self) -> list[list[list[list[str]]]]:
        """Get body text.

        :return: nested paragraphs [[[[str]]]]

        This is an alias for officeDocument.
        """
        return self.officeDocument

    @property
    def footnotes(self) -> list[list[list[list[str]]]]:
        """Get footnotes text.

        :return: nested paragraphs [[[[str]]]]
        """
        return _join_runs(self.footnotes_runs)

    @property
    def endnotes(self) -> list[list[list[list[str]]]]:
        """Get endnotes text.

        :return: nested paragraphs [[[[str]]]]
        """
        return _join_runs(self.endnotes_runs)

    @property
    def document(self) -> list[list[list[list[str]]]]:
        """All docx x properties concatenated.

        :return: nested paragraphs [[[[str]]]]
        """
        return self.header + self.body + self.footer + self.footnotes + self.endnotes

    @property
    def images(self) -> dict[str, bytes]:
        """Get bytestring of all images in the document.

        :return: dict {image_name: image_bytes}
        """
        return self.docx_reader.pull_image_files(self.image_folder)

    @property
    def text(self) -> str:
        r"""All docx paragraphs, "\n\n" joined.

        :return: all docx paragraphs, "\n\n" joined
        """
        return flatten_text(self.document_runs)

    @property
    def html_map(self) -> str:
        """A visual mapping of docx content.

        :return: html to show all strings with index tuples
        """
        return get_html_map(self.document_runs)

    @property
    def properties(self) -> dict[str, str | None]:
        """Document core-properties as a dictionary.

        :return: document core-properties as a dictionary

        Docx files created with Google docs won't have core-properties. If the file
        `core-properties` is missing, return an empty dict.
        """
        warn(
            "DocxContent.properties is deprecated and will be removed in some future "
            + "version. Use DocxContent.core_properties.",
            FutureWarning,
            stacklevel=2,
        )
        return self.core_properties

    @property
    def core_properties(self) -> dict[str, str | None]:
        """Document core-properties as a dictionary.

        :return: document core-properties as a dictionary

        Docx files created with Google docs won't have core-properties. If the file
        `core-properties` is missing, return an empty dict.
        """
        try:
            docProps = next(iter(self.docx_reader.files_of_type("core-properties")))
            return collect_docProps(docProps.root_element)
        except StopIteration:
            warn(
                "Could not find core-properties file (should be in docProps/core.xml) "
                + "in DOCX, so returning an empty core_properties dictionary. Docx "
                + "files created in Google Docs do not have a core-properties file, "
                + "so this may be expected.",
                stacklevel=2,
            )
            return {}

    @property
    def comments(self) -> list[tuple[str, str, str, str]]:
        """Get comments from the docx file.

        :return: tuples of (reference_text, author, date, comment_text)
        """
        office_document = self.docx_reader.file_of_type("officeDocument")
        depth_collector = office_document.depth_collector
        comment_ranges = depth_collector.comment_ranges
        comment_elements = self.docx_reader.comments

        if len(comment_ranges) != len(comment_elements):
            msg = (
                "comment_ranges and comment_elements have different lengths. "
                + "Failed to extract comments."
            )
            warn(msg, stacklevel=2)
            return []

        if not comment_elements:
            return []

        try:
            comments_file = self.docx_reader.file_of_type("comments")
        except KeyError:
            return []

        all_runs = list(enum_at_depth(get_par_strings(office_document.content), 5))
        comments: list[tuple[str, str, str, str]] = []
        for comment in comment_elements:
            id_ = get_attrib_by_qn(comment, "w:id")
            author = get_attrib_by_qn(comment, "w:author")
            date = get_attrib_by_qn(comment, "w:date")

            tree = new_depth_collector(comments_file, comment).tree_text
            tree_pars = ["".join(x) for x in iter_at_depth(tree, 4)]
            comment_text = "\n\n".join(tree_pars)

            beg_ref, end_ref = comment_ranges[id_]
            reference = "".join(y for _, y in all_runs[beg_ref:end_ref])

            comments.append((reference, author, date, comment_text))
        return comments

    def save_images(self, image_folder: str) -> dict[str, bytes]:
        """Write images to hard drive.

        :param image_folder: folder to write images to
        :return: dictionary of image names and image data

        If the image folder does not exist, it will not be created.
        """
        return self.docx_reader.pull_image_files(image_folder)


sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
with docx2python(sys.argv[1], duplicate_merged_cells=False) as docx_content:
    print(docx_content.text)
