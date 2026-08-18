"use client";

import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useI18n } from "@/lib/i18n";
import {
  apiFetch,
  BlockNode,
  BreadcrumbItem,
  Database,
  DatabaseFilter,
  DatabaseProperty,
  DatabaseRow,
  DatabaseSort
} from "@/lib/api";
import { parseCsv, rowsToCsv } from "@/lib/csv";
import { downloadTextFile } from "@/lib/markdown";

type DatabaseViewProps = {
  databaseBlock: BlockNode;
  breadcrumb: BreadcrumbItem[];
  onUpdateTitle: (blockId: string, title: string) => Promise<void>;
  onRefreshTree: () => Promise<void>;
  sidebarCollapsed: boolean;
  onOpenSidebar: () => void;
};

type EditingCell = {
  rowId: string;
  propertyId: string;
};

export default function DatabaseView({
  databaseBlock,
  breadcrumb,
  onUpdateTitle,
  onRefreshTree,
  sidebarCollapsed,
  onOpenSidebar
}: DatabaseViewProps) {
  const { t } = useI18n();
  const databaseId =
    typeof databaseBlock.properties.databaseId === "string"
      ? databaseBlock.properties.databaseId
      : "";

  const [database, setDatabase] = useState<Database | null>(null);
  const [rows, setRows] = useState<DatabaseRow[]>([]);
  const [draftTitle, setDraftTitle] = useState(
    databaseBlock.properties.title ?? ""
  );
  const [loading, setLoading] = useState(Boolean(databaseId));
  const [error, setError] = useState<string | null>(
    databaseId ? null : t("database.unavailable")
  );
  const [savingTitle, setSavingTitle] = useState(false);
  const [sort, setSort] = useState<DatabaseSort | null>(null);
  const [filters, setFilters] = useState<DatabaseFilter[]>([]);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState<DatabaseRow | null>(
    null
  );
  const [pendingDeletePropertyId, setPendingDeletePropertyId] = useState<
    string | null
  >(null);
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyType, setNewPropertyType] =
    useState<DatabaseProperty["type"]>("text");
  const [newSelectOptions, setNewSelectOptions] = useState("");
  const [filterPropertyId, setFilterPropertyId] = useState("");
  const [filterOperator, setFilterOperator] = useState<string>("contains");
  const [filterValue, setFilterValue] = useState<string>("");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<
    "table" | "list" | "gallery" | "board" | "calendar" | "timeline"
  >(
    "table"
  );

  const loadRows = useCallback(async (targetDatabaseId: string) => {
    const result = await apiFetch<{ rows: DatabaseRow[] }>(
      `/api/databases/${targetDatabaseId}/rows`
    );
    setRows(result.rows);
  }, []);

  useEffect(() => {
    let ignore = false;

    if (!databaseId) {
      return;
    }

    apiFetch<{ database: Database }>(`/api/databases/${databaseId}`)
      .then(async (result) => {
        if (ignore) {
          return;
        }
        setDatabase(result.database);
        setFilterPropertyId(result.database.propertiesSchema[0]?.id ?? "");
        await loadRows(result.database.id);
      })
      .catch((loadError) => {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("database.unavailable")
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [databaseId, loadRows, t]);

  const visibleRows = useMemo(
    () =>
      sortAndFilterRows(
        rows,
        database?.propertiesSchema ?? [],
        sort,
        filters
      ),
    [database?.propertiesSchema, filters, rows, sort]
  );

  async function saveTitle() {
    const title = draftTitle.trim();
    if (!title || !database || title === database.name) {
      return;
    }

    setSavingTitle(true);
    try {
      const result = await apiFetch<{ database: Database }>(
        `/api/databases/${database.id}`,
        {
        method: "PATCH",
        body: JSON.stringify({ name: title })
        }
      );
      setDatabase(result.database);
      await onUpdateTitle(databaseBlock.id, title);
    } finally {
      setSavingTitle(false);
    }
  }

  async function addRow() {
    if (!database) {
      return;
    }

    const result = await apiFetch<{ row: DatabaseRow }>(
      `/api/databases/${database.id}/rows`,
      {
        method: "POST",
        body: JSON.stringify({ properties: {} })
      }
    );
    setRows((current) => [...current, result.row]);
    await onRefreshTree();
  }

  async function performDeleteRow(row: DatabaseRow) {
    if (!database) {
      return;
    }

    await apiFetch<void>(`/api/databases/${database.id}/rows/${row.id}`, {
      method: "DELETE"
    });
    setRows((current) => current.filter((item) => item.id !== row.id));
    await onRefreshTree();
  }

  function requestDeleteRow(row: DatabaseRow) {
    setPendingDeleteRow(row);
  }

  function confirmDeleteRow() {
    const row = pendingDeleteRow;
    setPendingDeleteRow(null);
    if (row) {
      void performDeleteRow(row);
    }
  }

  async function saveCell(
    row: DatabaseRow,
    property: DatabaseProperty,
    value: unknown
  ) {
    if (!database) {
      return;
    }

    const normalizedValue = normalizeCellValue(property, value);
    const result = await apiFetch<{ row: DatabaseRow }>(
      `/api/databases/${database.id}/rows/${row.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          properties: { [property.id]: normalizedValue }
        })
      }
    );

    setRows((current) =>
      current.map((item) => (item.id === row.id ? result.row : item))
    );

    if (property.id === "title") {
      await onRefreshTree();
    }
  }

  async function addProperty() {
    if (!database || !newPropertyName.trim()) {
      return;
    }

    const property: DatabaseProperty = {
      id: makeId(),
      name: newPropertyName.trim(),
      type: newPropertyType
    };

    if (newPropertyType === "select") {
      property.options = newSelectOptions
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({
          id: makeId(),
          name,
          color: "zinc"
        }));
    }

    const result = await apiFetch<{ database: Database }>(
      `/api/databases/${database.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          properties: [...database.propertiesSchema, property]
        })
      }
    );

    setDatabase(result.database);
    setNewPropertyName("");
    setNewSelectOptions("");
    setNewPropertyType("text");
  }

  function exportCsv() {
    if (!database) {
      return;
    }

    const titleProperty =
      database.propertiesSchema.find((property) => property.id === "title") ??
      database.propertiesSchema[0];
    const headers = [
      titleProperty?.name ?? "Title",
      ...database.propertiesSchema
        .filter((property) => property.id !== titleProperty?.id)
        .map((property) => property.name)
    ];
    const csvRows = visibleRows.map((row) =>
      headers.map((header) => {
        const property =
          header === titleProperty?.name
            ? titleProperty
            : database.propertiesSchema.find(
                (item) => item.name === header
              );
        if (!property) {
          return "";
        }
        return csvValue(property, row.properties[property.id]);
      })
    );

    downloadTextFile(
      `${database.name || "database"}.csv`,
      rowsToCsv([headers, ...csvRows]),
      "text/csv"
    );
  }

  async function handleCsvImport(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !database) {
      return;
    }

    const text = await file.text();
    const parsed = parseCsv(text);
    const headers = parsed[0] ?? [];
    const dataRows = parsed.slice(1);

    await Promise.all(
      dataRows.map(async (values) => {
        const properties: Record<string, unknown> = {};

        headers.forEach((header, index) => {
          const property = database.propertiesSchema.find(
            (item) => item.name === header
          );
          if (!property) {
            return;
          }
          properties[property.id] = parseCsvValue(
            property,
            values[index] ?? ""
          );
        });

        await apiFetch<{ row: DatabaseRow }>(
          `/api/databases/${database.id}/rows`,
          {
            method: "POST",
            body: JSON.stringify({ properties })
          }
        );
      })
    );

    await loadRows(database.id);
    await onRefreshTree();
  }

  async function performDeleteProperty(propertyId: string) {
    if (!database || propertyId === "title") {
      return;
    }

    const result = await apiFetch<{ database: Database }>(
      `/api/databases/${database.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          properties: database.propertiesSchema.filter(
            (property) => property.id !== propertyId
          )
        })
      }
    );
    setDatabase(result.database);
    setFilters((current) =>
      current.filter((filter) => filter.propertyId !== propertyId)
    );
  }

  function requestDeleteProperty(propertyId: string) {
    setPendingDeletePropertyId(propertyId);
  }

  function confirmDeleteProperty() {
    const propertyId = pendingDeletePropertyId;
    setPendingDeletePropertyId(null);
    if (propertyId) {
      void performDeleteProperty(propertyId);
    }
  }

  function toggleSort(propertyId: string) {
    setSort((current) => {
      if (!current || current.propertyId !== propertyId) {
        return { propertyId, direction: "asc" };
      }
      if (current.direction === "asc") {
        return { propertyId, direction: "desc" };
      }
      return null;
    });
  }

  function addFilter() {
    const property = database?.propertiesSchema.find(
      (item) => item.id === filterPropertyId
    );
    if (!property) {
      return;
    }

    setFilters((current) => [
      ...current,
      {
        propertyId: filterPropertyId,
        operator: filterOperator as DatabaseFilter["operator"],
        value: normalizeCellValue(property, filterValue)
      }
    ]);
    setFilterValue("");
  }

  if (loading) {
    return (
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-10">
        <p className="text-zinc-500">{t("database.loading")}</p>
      </main>
    );
  }

  if (error || !database) {
    return (
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-10">
        <p className="text-red-600">{error ?? t("database.unavailable")}</p>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-10">
      <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-zinc-500">
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="mr-1 rounded-md p-1 text-zinc-500 hover:bg-zinc-200"
          >
            ☰
          </button>
        )}
        {breadcrumb.map((item, index) => (
          <span key={item.id} className="flex items-center gap-1">
            {index > 0 && <span>/</span>}
            <span
              className={index === breadcrumb.length - 1 ? "text-zinc-900" : ""}
            >
              {item.title || t("editor.placeholder")}
            </span>
          </span>
        ))}
      </nav>

      <input
        value={draftTitle}
        onChange={(event) => setDraftTitle(event.target.value)}
        onBlur={saveTitle}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        disabled={savingTitle}
        className="w-full border-0 bg-transparent text-4xl font-semibold tracking-tight outline-none placeholder:text-zinc-300"
        placeholder={t("database.title")}
      />

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          {t("database.newRow")}
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
        >
          {t("database.exportCsv")}
        </button>
        <button
          type="button"
          onClick={() => csvInputRef.current?.click()}
          className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200"
        >
          {t("database.importCsv")}
        </button>
        <button
          type="button"
          onClick={() => setViewMode("table")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            viewMode === "table"
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          Table
        </button>
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            viewMode === "list"
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => setViewMode("gallery")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            viewMode === "gallery"
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          Gallery
        </button>
        <button
          type="button"
          onClick={() => setViewMode("board")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            viewMode === "board"
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          Board
        </button>
        <button
          type="button"
          onClick={() => setViewMode("calendar")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            viewMode === "calendar"
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          Calendar
        </button>
        <button
          type="button"
          onClick={() => setViewMode("timeline")}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            viewMode === "timeline"
              ? "bg-zinc-900 text-white"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
          }`}
        >
          Timeline
        </button>
      </div>

      <input
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleCsvImport}
      />

      <div className="mt-5 rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center gap-2 border-b border-zinc-100 p-3">
          <input
            value={newPropertyName}
            onChange={(event) => setNewPropertyName(event.target.value)}
            placeholder={t("database.propertyName")}
            className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
          <select
            value={newPropertyType}
            onChange={(event) =>
              setNewPropertyType(event.target.value as DatabaseProperty["type"])
            }
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="text">{t("database.property.text")}</option>
            <option value="number">{t("database.property.number")}</option>
            <option value="select">{t("database.property.select")}</option>
            <option value="date">{t("database.property.date")}</option>
            <option value="checkbox">{t("database.property.checkbox")}</option>
          </select>
          {newPropertyType === "select" && (
            <input
              value={newSelectOptions}
              onChange={(event) => setNewSelectOptions(event.target.value)}
              placeholder={t("database.selectOptions")}
              className="w-52 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          )}
          <button
            type="button"
            onClick={addProperty}
            disabled={!newPropertyName.trim()}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
          >
            {t("database.addProperty")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2">
          <select
            value={filterPropertyId}
            onChange={(event) => setFilterPropertyId(event.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {database.propertiesSchema.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <select
            value={filterOperator}
            onChange={(event) => setFilterOperator(event.target.value)}
            className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {filterOperatorsForProperty(
              database.propertiesSchema.find(
                (property) => property.id === filterPropertyId
              )
            ).map((operator) => (
              <option key={operator.value} value={operator.value}>
                {operator.label}
              </option>
            ))}
          </select>
          <FilterValueInput
            property={database.propertiesSchema.find(
              (property) => property.id === filterPropertyId
            )}
            value={filterValue}
            onChange={setFilterValue}
          />
          <button
            type="button"
            onClick={addFilter}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm font-medium hover:bg-zinc-200"
          >
            {t("database.addFilter")}
          </button>

          {filters.map((filter, index) => {
            const property = database.propertiesSchema.find(
              (item) => item.id === filter.propertyId
            );
            return (
              <button
                key={`${filter.propertyId}-${index}`}
                type="button"
                onClick={() =>
                  setFilters((current) =>
                    current.filter((_, currentIndex) => currentIndex !== index)
                  )
                }
                className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                {property?.name ?? filter.propertyId} {filter.operator}{" "}
                {formatFilterValue(filter.value)} ×
              </button>
            );
          })}
        </div>

        {viewMode === "table" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                {database.propertiesSchema.map((property) => (
                  <th
                    key={property.id}
                    className="whitespace-nowrap px-3 py-2 font-medium text-zinc-600"
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleSort(property.id)}
                        className="hover:text-zinc-900"
                      >
                        {property.name}
                        {sort?.propertyId === property.id
                          ? sort.direction === "asc"
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </button>
                      {property.id !== "title" && (
                        <button
                          type="button"
                          onClick={() => requestDeleteProperty(property.id)}
                          className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-red-600"
                          aria-label={`Delete ${property.name}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-zinc-100 last:border-0"
                >
                  {database.propertiesSchema.map((property) => (
                    <td
                      key={property.id}
                      className="min-w-36 px-3 py-2 align-top"
                    >
                      <Cell
                        row={row}
                        property={property}
                        isEditing={
                          editingCell?.rowId === row.id &&
                          editingCell?.propertyId === property.id
                        }
                        onStartEdit={() => setEditingCell({
                          rowId: row.id,
                          propertyId: property.id
                        })}
                        onCancelEdit={() => setEditingCell(null)}
                        onSave={(value) => {
                          setEditingCell(null);
                          void saveCell(row, property, value);
                        }}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => requestDeleteRow(row)}
                      className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-red-600"
          aria-label={t("database.deleteRow")}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {viewMode === "list" && (
          <div className="space-y-2 p-3">
            {visibleRows.map((row) => {
              const title = String(row.properties.title ?? "");
              return (
                <div
                  key={row.id}
                  className="rounded-lg border border-zinc-200 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{title || "Untitled"}</p>
                    <button
                      type="button"
                      onClick={() => requestDeleteRow(row)}
                      className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-red-600"
                      aria-label={t("database.deleteRow")}
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
                    {database.propertiesSchema
                      .filter((property) => property.id !== "title")
                      .map((property) => (
                        <span key={property.id}>
                          <span className="text-zinc-400">{property.name}: </span>
                          {formatCellValue(property, row.properties[property.id])}
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "gallery" && (
          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleRows.map((row) => {
              const title = String(row.properties.title ?? "");
              return (
                <div
                  key={row.id}
                  className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{title || "Untitled"}</p>
                    <button
                      type="button"
                      onClick={() => requestDeleteRow(row)}
                      className="rounded px-1 text-zinc-400 hover:bg-zinc-200 hover:text-red-600"
                      aria-label={t("database.deleteRow")}
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-zinc-600">
                    {database.propertiesSchema
                      .filter((property) => property.id !== "title")
                      .map((property) => (
                        <div key={property.id}>
                          <span className="text-zinc-400">{property.name}: </span>
                          {formatCellValue(property, row.properties[property.id])}
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "board" && (
          <div className="flex gap-3 overflow-x-auto p-3">
            {boardColumns(database, visibleRows).map((column) => (
              <div
                key={column.id}
                className="min-w-56 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 p-2"
              >
                <p className="px-2 py-1 text-sm font-medium text-zinc-600">
                  {column.name}
                </p>
                <div className="mt-2 space-y-2">
                  {column.rows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-md border border-zinc-200 bg-white p-3 text-sm"
                    >
                      <p className="font-medium">
                        {String(row.properties.title ?? "") || "Untitled"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                        {database.propertiesSchema
                          .filter((property) => property.id !== "title")
                          .map((property) => (
                            <span key={property.id}>
                              {property.name}:{" "}
                              {formatCellValue(property, row.properties[property.id])}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === "calendar" && (
          <div className="space-y-3 p-3">
            {calendarGroups(database, visibleRows).map((group) => (
              <div key={group.date}>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  {group.date || "No date"}
                </p>
                <div className="mt-1 space-y-2">
                  {group.rows.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-lg border border-zinc-200 bg-white p-3"
                    >
                      <p className="font-medium">
                        {String(row.properties.title ?? "") || "Untitled"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500">
                        {database.propertiesSchema
                          .filter((property) => property.id !== "title")
                          .map((property) => (
                            <span key={property.id}>
                              {property.name}:{" "}
                              {formatCellValue(property, row.properties[property.id])}
                            </span>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {viewMode === "timeline" && (
          <div className="space-y-5 p-3">
            {calendarGroups(database, visibleRows).map((group) => (
              <div key={group.date}>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                  {group.date || "No date"}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {group.rows.map((row) => (
                    <div
                      key={row.id}
                      className="min-w-44 rounded-lg border border-zinc-200 bg-white p-3"
                    >
                      <p className="font-medium">
                        {String(row.properties.title ?? "") || "Untitled"}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-zinc-500">
                        {database.propertiesSchema
                          .filter((property) => property.id !== "title")
                          .map((property) => (
                            <p key={property.id}>
                              {property.name}:{" "}
                              {formatCellValue(property, row.properties[property.id])}
                            </p>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </main>

      <ConfirmDialog
        open={pendingDeleteRow !== null}
        title={t("database.deleteRowTitle")}
        message={t("database.deleteRowMessage")}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={confirmDeleteRow}
        onCancel={() => setPendingDeleteRow(null)}
      />

      <ConfirmDialog
        open={pendingDeletePropertyId !== null}
        title={t("database.deletePropertyTitle")}
        message={t("database.deletePropertyMessage")}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={confirmDeleteProperty}
        onCancel={() => setPendingDeletePropertyId(null)}
      />
    </>
  );
}

function Cell({
  row,
  property,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave
}: {
  row: DatabaseRow;
  property: DatabaseProperty;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (value: unknown) => void;
}) {
  const value = row.properties[property.id];

  if (property.type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => onSave(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-zinc-300"
      />
    );
  }

  if (isEditing) {
    return (
      <InlineCellEditor
        key={`${row.id}-${property.id}`}
        property={property}
        value={value}
        onCancel={onCancelEdit}
        onSave={onSave}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={onStartEdit}
      className="min-h-6 w-full cursor-text rounded px-1 text-left text-zinc-800 hover:bg-zinc-50"
    >
      {formatCellValue(property, value)}
    </button>
  );
}

function InlineCellEditor({
  property,
  value,
  onCancel,
  onSave
}: {
  property: DatabaseProperty;
  value: unknown;
  onCancel: () => void;
  onSave: (value: unknown) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(formatInputValue(property, value));

  function commit() {
    onSave(coerceInputValue(property, draft));
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      commit();
    }
    if (event.key === "Escape") {
      onCancel();
    }
  }

  if (property.type === "select") {
    return (
      <select
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        className="w-full rounded border border-blue-300 px-2 py-1"
      >
        <option value="">{t("database.empty")}</option>
        {property.options?.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      autoFocus
      type={
        property.type === "number"
          ? "number"
          : property.type === "date"
            ? "date"
            : "text"
      }
      value={draft}
      onChange={(event: ChangeEvent<HTMLInputElement>) =>
        setDraft(event.target.value)
      }
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className="w-full rounded border border-blue-300 px-2 py-1"
    />
  );
}

function FilterValueInput({
  property,
  value,
  onChange
}: {
  property?: DatabaseProperty;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  if (property?.type === "select") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
      >
        <option value="">{t("database.empty")}</option>
        {property.options?.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    );
  }

  if (property?.type === "checkbox") {
    return (
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
      >
        <option value="">{t("database.empty")}</option>
        <option value="true">{t("database.checked")}</option>
        <option value="false">{t("database.unchecked")}</option>
      </select>
    );
  }

  return (
    <input
      type={
        property?.type === "number"
          ? "number"
          : property?.type === "date"
            ? "date"
            : "text"
      }
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={t("database.filterValue")}
      className="w-40 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
    />
  );
}

function sortAndFilterRows(
  rows: DatabaseRow[],
  properties: DatabaseProperty[],
  sort: DatabaseSort | null,
  filters: DatabaseFilter[]
): DatabaseRow[] {
  const filtered = rows.filter((row) => matchesFilters(row, filters));
  if (!sort) {
    return filtered;
  }

  const property = properties.find((item) => item.id === sort.propertyId);
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...filtered].sort((left, right) => {
    const comparison = compareCellValues(
      left.properties[sort.propertyId],
      right.properties[sort.propertyId],
      property
    );
    if (comparison === 0) {
      return left.position - right.position;
    }
    return comparison * direction;
  });
}

function matchesFilters(row: DatabaseRow, filters: DatabaseFilter[]): boolean {
  return filters.every((filter) => {
    const value = row.properties[filter.propertyId];
    switch (filter.operator) {
      case "equals":
        return formatCellValueForCompare(value) ===
          formatCellValueForCompare(filter.value);
      case "not_equals":
        return formatCellValueForCompare(value) !==
          formatCellValueForCompare(filter.value);
      case "contains":
        return String(value ?? "")
          .toLowerCase()
          .includes(String(filter.value ?? "").toLowerCase());
      case "greater_than":
        return compareCellValues(value, filter.value, undefined) > 0;
      case "less_than":
        return compareCellValues(value, filter.value, undefined) < 0;
      case "is_empty":
        return isEmptyCell(value);
      case "is_not_empty":
        return !isEmptyCell(value);
      default:
        return true;
    }
  });
}

function compareCellValues(
  left: unknown,
  right: unknown,
  property?: DatabaseProperty
): number {
  if (property?.type === "number") {
    return Number(left ?? 0) - Number(right ?? 0);
  }
  if (property?.type === "checkbox") {
    return Number(Boolean(left)) - Number(Boolean(right));
  }

  const leftString = String(left ?? "").toLowerCase();
  const rightString = String(right ?? "").toLowerCase();
  if (leftString < rightString) {
    return -1;
  }
  if (leftString > rightString) {
    return 1;
  }
  return 0;
}

function formatCellValue(property: DatabaseProperty, value: unknown): string {
  if (isEmptyCell(value)) {
    return "Empty";
  }
  if (property.type === "select") {
    return (
      property.options?.find((option) => option.id === value)?.name ?? "Empty"
    );
  }
  if (property.type === "checkbox") {
    return value ? "✓" : "—";
  }
  return String(value);
}

function formatCellValueForCompare(value: unknown): string {
  return String(value ?? "");
}

function formatInputValue(property: DatabaseProperty, value: unknown): string {
  if (isEmptyCell(value)) {
    return "";
  }
  return String(value);
}

function coerceInputValue(property: DatabaseProperty, value: string): unknown {
  if (property.type === "number") {
    return value === "" ? 0 : Number(value);
  }
  return value;
}

function normalizeCellValue(
  property: DatabaseProperty,
  value: unknown
): unknown {
  if (property.type === "number") {
    return typeof value === "number" ? value : Number(value || 0);
  }
  if (property.type === "checkbox") {
    return typeof value === "boolean" ? value : value === "true";
  }
  return value ?? "";
}

function isEmptyCell(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (typeof value === "number") {
    return value === 0;
  }
  if (typeof value === "boolean") {
    return !value;
  }
  return false;
}

function filterOperatorsForProperty(
  property?: DatabaseProperty
): Array<{ value: string; label: string }> {
  if (property?.type === "checkbox") {
    return [
      { value: "equals", label: "equals" },
      { value: "not_equals", label: "not equals" },
      { value: "is_empty", label: "is empty" },
      { value: "is_not_empty", label: "is not empty" }
    ];
  }

  const operators = [
    { value: "contains", label: "contains" },
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "not equals" },
    { value: "greater_than", label: "greater than" },
    { value: "less_than", label: "less than" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" }
  ];

  if (property?.type === "text") {
    return operators;
  }

  return operators.filter((operator) => operator.value !== "contains");
}

function formatFilterValue(value: unknown): string {
  if (value === true) {
    return "true";
  }
  if (value === false) {
    return "false";
  }
  return String(value ?? "");
}

function csvValue(property: DatabaseProperty, value: unknown): string {
  if (property.type === "select") {
    return (
      property.options?.find((option) => option.id === value)?.name ?? ""
    );
  }
  if (property.type === "checkbox") {
    return value ? "true" : "false";
  }
  return value == null ? "" : String(value);
}

function parseCsvValue(property: DatabaseProperty, value: string): unknown {
  if (property.type === "number") {
    return value.trim() === "" ? 0 : Number(value);
  }
  if (property.type === "checkbox") {
    return value.trim().toLowerCase() === "true";
  }
  if (property.type === "select") {
    return (
      property.options?.find(
        (option) => option.name.toLowerCase() === value.trim().toLowerCase()
      )?.id ?? ""
    );
  }
  return value;
}

function boardColumns(
  database: Database,
  rows: DatabaseRow[]
): Array<{ id: string; name: string; rows: DatabaseRow[] }> {
  const selectProperty = database.propertiesSchema.find(
    (property) => property.type === "select"
  );
  if (!selectProperty) {
    return [{ id: "all", name: "All", rows }];
  }

  const options = selectProperty.options ?? [];
  const columns = options.map((option) => ({
    id: option.id,
    name: option.name,
    rows: rows.filter(
      (row) => row.properties[selectProperty.id] === option.id
    )
  }));
  columns.push({
    id: "empty",
    name: "Empty",
    rows: rows.filter(
      (row) =>
        !row.properties[selectProperty.id] ||
        !options.some(
          (option) => option.id === row.properties[selectProperty.id]
        )
    )
  });
  return columns;
}

function calendarGroups(
  database: Database,
  rows: DatabaseRow[]
): Array<{ date: string; rows: DatabaseRow[] }> {
  const dateProperty = database.propertiesSchema.find(
    (property) => property.type === "date"
  );
  const groups = new Map<string, DatabaseRow[]>();

  for (const row of rows) {
    const date = dateProperty
      ? String(row.properties[dateProperty.id] ?? "")
      : "";
    const list = groups.get(date) ?? [];
    list.push(row);
    groups.set(date, list);
  }

  return Array.from(groups.entries())
    .map(([date, dateRows]) => ({ date, rows: dateRows }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
