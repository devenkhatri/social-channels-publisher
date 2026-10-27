import { NextRequest, NextResponse } from "next/server";
import { client } from "@/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get("table");
    const search = searchParams.get("search") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "25", 10)));
    const sortBy = searchParams.get("sortBy") || "";
    const sortOrder = searchParams.get("sortOrder") === "desc" ? "DESC" : "ASC";

    // 1. Fetch all tables in database
    const masterQuery = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC;"
    );

    const availableTableNames: string[] = masterQuery.rows.map((r: any) => String(r.name));

    // Get counts and column structure for all tables
    const tableSummaries: Array<{
      name: string;
      rowCount: number;
      columns: Array<{
        cid: number;
        name: string;
        type: string;
        notnull: number;
        dflt_value: any;
        pk: number;
      }>;
    }> = [];

    for (const name of availableTableNames) {
      try {
        const countRes = await client.execute(`SELECT count(*) as count FROM "${name}";`);
        const count = Number(countRes.rows[0]?.count ?? 0);

        const infoRes = await client.execute(`PRAGMA table_info("${name}");`);
        const columns = infoRes.rows.map((c: any) => ({
          cid: Number(c.cid),
          name: String(c.name),
          type: String(c.type || "TEXT"),
          notnull: Number(c.notnull),
          dflt_value: c.dflt_value,
          pk: Number(c.pk),
        }));

        tableSummaries.push({
          name,
          rowCount: count,
          columns,
        });
      } catch (tableErr) {
        console.error(`Failed to inspect table ${name}:`, tableErr);
      }
    }

    // If no specific table requested, default to the first one or return summary
    const selectedTable = tableName && availableTableNames.includes(tableName)
      ? tableName
      : availableTableNames[0] || null;

    if (!selectedTable) {
      return NextResponse.json({
        tables: tableSummaries,
        selectedTable: null,
        columns: [],
        rows: [],
        totalRows: 0,
        page: 1,
        limit,
        totalPages: 1,
      });
    }

    // Get columns for the selected table
    const selectedSummary = tableSummaries.find((t) => t.name === selectedTable);
    const columns = selectedSummary?.columns || [];

    // Build query for selected table rows with optional search & pagination
    let whereClause = "";
    const queryArgs: any[] = [];

    if (search.trim()) {
      const textColumns = columns.filter((col) =>
        ["TEXT", "VARCHAR", "STRING", "CHAR"].some((t) => col.type.toUpperCase().includes(t)) ||
        col.pk === 1
      );
      if (textColumns.length > 0) {
        const conditions = textColumns.map((col) => `"${col.name}" LIKE ?`);
        whereClause = `WHERE ${conditions.join(" OR ")}`;
        for (let i = 0; i < textColumns.length; i++) {
          queryArgs.push(`%${search.trim()}%`);
        }
      }
    }

    // Total count for current filter
    const totalQuerySql = `SELECT count(*) as count FROM "${selectedTable}" ${whereClause};`;
    const filteredCountRes = await client.execute({
      sql: totalQuerySql,
      args: queryArgs,
    });
    const totalFiltered = Number(filteredCountRes.rows[0]?.count ?? 0);

    // Sorting
    let orderClause = "";
    if (sortBy && columns.some((c) => c.name === sortBy)) {
      orderClause = `ORDER BY "${sortBy}" ${sortOrder}`;
    } else {
      // Default sort by primary key or created_at or rowid desc
      const pkCol = columns.find((c) => c.pk > 0);
      const createdAtCol = columns.find((c) => c.name === "created_at" || c.name === "updated_at");
      if (createdAtCol) {
        orderClause = `ORDER BY "${createdAtCol.name}" DESC`;
      } else if (pkCol) {
        orderClause = `ORDER BY "${pkCol.name}" ASC`;
      } else {
        orderClause = `ORDER BY rowid DESC`;
      }
    }

    const offset = (page - 1) * limit;
    const dataQuerySql = `SELECT * FROM "${selectedTable}" ${whereClause} ${orderClause} LIMIT ? OFFSET ?;`;
    const dataArgs = [...queryArgs, limit, offset];

    const dataRes = await client.execute({
      sql: dataQuerySql,
      args: dataArgs,
    });

    const rows = dataRes.rows.map((row: any) => {
      // libSQL rows may be objects or array-like
      const obj: Record<string, any> = {};
      for (const col of columns) {
        obj[col.name] = row[col.name];
      }
      return obj;
    });

    return NextResponse.json({
      tables: tableSummaries,
      selectedTable,
      columns,
      rows,
      totalRows: totalFiltered,
      page,
      limit,
      totalPages: Math.ceil(totalFiltered / limit) || 1,
    });
  } catch (error: any) {
    if (error?.digest) throw error;
    console.error("Database explorer API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to inspect database" },
      { status: 500 }
    );
  }
}
