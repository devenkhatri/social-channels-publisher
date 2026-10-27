"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  Table as TableIcon,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Key,
  Copy,
  Check,
  Download,
  Eye,
  X,
  FileCode,
  Hash,
  Calendar,
  Type,
  ToggleLeft,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: any;
  pk: number;
}

interface TableSummary {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
}

interface DatabaseApiResponse {
  tables: TableSummary[];
  selectedTable: string | null;
  columns: ColumnInfo[];
  rows: Array<Record<string, any>>;
  totalRows: number;
  page: number;
  limit: number;
  totalPages: number;
  error?: string;
}

export default function DatabasePage() {
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [sortBy, setSortBy] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [activeCellModal, setActiveCellModal] = useState<{
    column: string;
    value: any;
    isJson: boolean;
  } | null>(null);
  const [copiedCellKey, setCopiedCellKey] = useState<string | null>(null);

  // Fetch tables and current table data
  const { data, isLoading, isRefetching, refetch, isError, error } =
    useQuery<DatabaseApiResponse>({
      queryKey: [
        "database-explorer",
        selectedTable,
        searchQuery,
        page,
        limit,
        sortBy,
        sortOrder,
      ],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (selectedTable) params.set("table", selectedTable);
        if (searchQuery.trim()) params.set("search", searchQuery.trim());
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (sortBy) {
          params.set("sortBy", sortBy);
          params.set("sortOrder", sortOrder);
        }

        const res = await fetch(`/api/database?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to inspect database");
        }
        return res.json();
      },
      staleTime: 10000,
    });

  // Keep selectedTable in sync with the first table returned if empty
  const activeTable = selectedTable || data?.selectedTable || (data?.tables?.[0]?.name ?? "");
  const tableColumns: ColumnInfo[] = data?.columns ?? [];
  const tableRows: Array<Record<string, any>> = data?.rows ?? [];

  const handleTableChange = (tableName: string) => {
    setSelectedTable(tableName);
    setPage(1);
    setSearchQuery("");
    setSortBy("");
  };

  const handleSort = (colName: string) => {
    if (sortBy === colName) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(colName);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCellKey(key);
      setTimeout(() => setCopiedCellKey(null), 2000);
    } catch {
      // Fallback
    }
  };

  // Export current table rows as JSON
  const downloadJson = () => {
    if (!data?.rows || data.rows.length === 0) return;
    const blob = new Blob([JSON.stringify(data.rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTable}-export-page-${page}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export current table rows as CSV
  const downloadCsv = () => {
    if (!data?.rows || data.rows.length === 0 || !data.columns) return;
    const cols = data.columns.map((c) => c.name);
    const headers = cols.join(",");
    const csvRows = data.rows.map((row) =>
      cols
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return '""';
          const str = typeof val === "object" ? JSON.stringify(val) : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csvContent = [headers, ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTable}-export-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper for type icons
  const getTypeBadge = (type: string, isPk: boolean) => {
    const t = type.toUpperCase();
    let color = "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";
    if (t.includes("INT")) {
      color = "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    } else if (t.includes("CHAR") || t.includes("TEXT")) {
      color = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
    }

    return (
      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border ${color}`}
      >
        {isPk && <Key className="w-2.5 h-2.5 text-amber-500" />}
        <span>{type || "TEXT"}</span>
      </span>
    );
  };

  // Format cell display
  const formatCellValue = (val: any) => {
    if (val === null || val === undefined) {
      return <span className="text-zinc-300 dark:text-zinc-600 italic">null</span>;
    }
    if (typeof val === "boolean") {
      return (
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            val
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
          }`}
        >
          {val ? "true" : "false"}
        </span>
      );
    }
    if (typeof val === "number") {
      return <span className="font-mono text-zinc-800 dark:text-zinc-200">{val}</span>;
    }

    const str = String(val);

    // Check if valid JSON object/array
    if (
      (str.startsWith("{") && str.endsWith("}")) ||
      (str.startsWith("[") && str.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(str);
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] truncate max-w-[200px]">
            <FileCode className="w-3 h-3 shrink-0" />
            <span className="truncate">JSON ({Array.isArray(parsed) ? `${parsed.length} items` : Object.keys(parsed).length + " keys"})</span>
          </span>
        );
      } catch {
        // Not JSON
      }
    }

    // Encrypted API key / hash / secret representation
    if (str.length > 50 && !str.includes(" ")) {
      return (
        <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 truncate max-w-[220px] block" title={str}>
          {str.slice(0, 16)}...{str.slice(-8)}
        </span>
      );
    }

    // Check if ISO date string
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(str)) {
      return (
        <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
          {str}
        </span>
      );
    }

    return (
      <span className="truncate max-w-[280px] block text-zinc-800 dark:text-zinc-200" title={str}>
        {str}
      </span>
    );
  };

  const totalAllRows = useMemo(() => {
    if (!data?.tables) return 0;
    return data.tables.reduce((acc, t) => acc + t.rowCount, 0);
  }, [data?.tables]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center shadow-xs">
              <Database className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Database Explorer
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Inspect all SQLite / LibSQL database tables, columns, schema structure, and raw records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isLoading || isRefetching ? "animate-spin text-zinc-400" : ""
              }`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="font-medium">Total Tables</span>
            <TableIcon className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {isLoading ? "..." : data?.tables?.length ?? 0}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">SQLite schema tables</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="font-medium">Total Rows</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {isLoading ? "..." : totalAllRows.toLocaleString()}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">Across all tables</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="font-medium">Active Table</span>
            <Database className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
            {activeTable || "None"}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {data?.columns?.length ?? 0} columns defined
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="font-medium">Filtered Rows</span>
            <Hash className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {isLoading ? "..." : data?.totalRows?.toLocaleString() ?? 0}
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">In current view</p>
        </div>
      </div>

      {/* Table Selector Tabs */}
      {data?.tables && data.tables.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {data.tables.map((t) => {
            const isSelected = (activeTable === t.name);
            return (
              <button
                key={t.name}
                onClick={() => handleTableChange(t.name)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs whitespace-nowrap transition-all border ${
                  isSelected
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs font-semibold"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5 opacity-70" />
                <span className="font-mono">{t.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected
                      ? "bg-zinc-800 text-zinc-200 dark:bg-zinc-200 dark:text-zinc-800"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {t.rowCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Table Toolbar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder={`Search in ${activeTable || "table"}...`}
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Actions: Export and Rows per page */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span>Show:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none"
            >
              <option value="15">15 rows</option>
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
            </select>
          </div>

          <div className="h-4 w-[1px] bg-zinc-200 dark:border-zinc-800 mx-1" />

          {/* Export Buttons */}
          <button
            onClick={downloadCsv}
            disabled={!data?.rows || data.rows.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-40"
            title="Download CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            onClick={downloadJson}
            disabled={!data?.rows || data.rows.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-40"
            title="Download JSON"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Schema Columns Badges */}
      {data?.columns && data.columns.length > 0 && (
        <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 mb-2">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Table Schema ({data.columns.length} columns):</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.columns.map((col) => (
              <button
                key={col.cid}
                onClick={() => handleSort(col.name)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono border transition-all ${
                  sortBy === col.name
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs"
                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
                }`}
              >
                <span>{col.name}</span>
                {getTypeBadge(col.type, col.pk > 0)}
                {sortBy === col.name && (
                  sortOrder === "asc" ? (
                    <ArrowUp className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <ArrowDown className="w-3 h-3 text-emerald-400" />
                  )
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Data Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-zinc-50 dark:bg-zinc-950/80 sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold text-[11px] tracking-wider uppercase">
              <tr>
                <th className="py-3 px-3 w-10 text-center font-mono text-[10px] text-zinc-400 border-r border-zinc-200/50 dark:border-zinc-800/50">
                  #
                </th>
                {data?.columns?.map((col) => {
                  const isSorted = sortBy === col.name;
                  return (
                    <th
                      key={col.cid}
                      onClick={() => handleSort(col.name)}
                      className="py-3 px-4 whitespace-nowrap cursor-pointer hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-zinc-800 dark:text-zinc-200 lowercase">
                          {col.name}
                        </span>
                        {getTypeBadge(col.type, col.pk > 0)}
                        <span className="text-zinc-400">
                          {isSorted ? (
                            sortOrder === "asc" ? (
                              <ArrowUp className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-emerald-500" />
                            )
                          ) : (
                            <ArrowUpDown className="w-2.5 h-2.5 opacity-40 hover:opacity-100" />
                          )}
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-sans">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={tableColumns.length + 1}
                    className="py-16 text-center text-zinc-400 text-xs"
                  >
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                    <span>Loading table records...</span>
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColumns.length + 1}
                    className="py-16 text-center text-zinc-400 text-xs"
                  >
                    <div className="max-w-xs mx-auto space-y-1">
                      <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                        No rows found
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        {searchQuery
                          ? `No rows in "${activeTable}" match "${searchQuery}"`
                          : `The table "${activeTable}" has 0 rows`}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                tableRows.map((row, rowIdx) => {
                  const rowNumber = (page - 1) * limit + rowIdx + 1;
                  return (
                    <tr
                      key={rowIdx}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-[10px] text-zinc-400 border-r border-zinc-100 dark:border-zinc-800">
                        {rowNumber}
                      </td>
                      {tableColumns.map((col) => {
                        const cellValue = row[col.name];
                        const cellString =
                          cellValue === null || cellValue === undefined
                            ? ""
                            : typeof cellValue === "object"
                            ? JSON.stringify(cellValue, null, 2)
                            : String(cellValue);
                        const isJson =
                          typeof cellValue === "object" ||
                          (typeof cellValue === "string" &&
                            ((cellValue.startsWith("{") && cellValue.endsWith("}")) ||
                              (cellValue.startsWith("[") && cellValue.endsWith("]"))));
                        const cellKey = `${rowIdx}-${col.name}`;

                        return (
                          <td
                            key={col.cid}
                            className="py-2.5 px-4 whitespace-nowrap text-xs max-w-[320px]"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div
                                onClick={() => {
                                  if (cellString.length > 25 || isJson) {
                                    setActiveCellModal({
                                      column: col.name,
                                      value: cellValue,
                                      isJson,
                                    });
                                  }
                                }}
                                className={`truncate ${
                                  cellString.length > 25 || isJson
                                    ? "cursor-pointer hover:underline"
                                    : ""
                                }`}
                              >
                                {formatCellValue(cellValue)}
                              </div>

                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                                {cellString && (
                                  <button
                                    onClick={() => copyToClipboard(cellString, cellKey)}
                                    className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                                    title="Copy cell value"
                                  >
                                    {copiedCellKey === cellKey ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                                {(cellString.length > 25 || isJson) && (
                                  <button
                                    onClick={() =>
                                      setActiveCellModal({
                                        column: col.name,
                                        value: cellValue,
                                        isJson,
                                      })
                                    }
                                    className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                                    title="View full content"
                                  >
                                    <Eye className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            Showing{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {data?.rows ? (page - 1) * limit + (data.rows.length > 0 ? 1 : 0) : 0}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">
              {data?.rows ? (page - 1) * limit + data.rows.length : 0}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
              {data?.totalRows ?? 0}
            </span>{" "}
            rows in <span className="font-mono font-semibold">{activeTable}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="text-xs font-mono text-zinc-500 px-2">
              Page {page} of {data?.totalPages || 1}
            </span>

            <button
              onClick={() => setPage((prev) => Math.min(data?.totalPages || 1, prev + 1))}
              disabled={page >= (data?.totalPages || 1) || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Cell Detail / Full Inspector Modal */}
      {activeCellModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-zinc-500" />
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 font-mono">
                  {activeCellModal.column}
                </h3>
                {activeCellModal.isJson && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    JSON Object
                  </span>
                )}
              </div>
              <button
                onClick={() => setActiveCellModal(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs bg-zinc-50 dark:bg-zinc-950/80 text-zinc-800 dark:text-zinc-200">
              <pre className="whitespace-pre-wrap break-words">
                {activeCellModal.isJson
                  ? typeof activeCellModal.value === "string"
                    ? JSON.stringify(JSON.parse(activeCellModal.value), null, 2)
                    : JSON.stringify(activeCellModal.value, null, 2)
                  : String(activeCellModal.value)}
              </pre>
            </div>

            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-end gap-2">
              <button
                onClick={() => {
                  const content = activeCellModal.isJson
                    ? typeof activeCellModal.value === "string"
                      ? JSON.stringify(JSON.parse(activeCellModal.value), null, 2)
                      : JSON.stringify(activeCellModal.value, null, 2)
                    : String(activeCellModal.value);
                  navigator.clipboard.writeText(content);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs hover:opacity-90 transition-opacity"
              >
                Copy Content
              </button>
              <button
                onClick={() => setActiveCellModal(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
