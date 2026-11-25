    # SQL Query Builder

  A powerful, visual SQL query builder designed for BigQuery that enables users to construct complex queries without writing raw   SQL. This tool provides an intuitive interface for building queries with filters, joins, aggregations, and more.

    ## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Database and Table Selection](#database-and-table-selection)
- [Filter System](#filter-system)
- [Filter Chaining](#filter-chaining)
- [Select Columns](#select-columns)
- [GROUP BY](#group-by)
- [Aggregation Functions](#aggregation-functions)
- [HAVING Clause](#having-clause)
- [ORDER BY](#order-by)
- [LIMIT](#limit)
- [Multi-Table Support](#multi-table-support)
- [JOIN Operations](#join-operations)
- [SQL Preview](#sql-preview)
- [Save Dataset](#save-dataset)
- [SQL Generation Notes](#sql-generation-notes)
- [Architecture](#architecture)
- [Usage Guide](#usage-guide)

    ---

    ## Introduction

    The SQL Query Builder is a React-based visual interface that abstracts the complexity of SQL syntax while providing full control over query construction. It is specifically designed for Google BigQuery and generates optimized CTE (Common Table Expression) based queries.

    ### Key Benefits

    - **No SQL Knowledge Required**: Build complex queries using dropdowns and toggles
    - **Visual Query Construction**: See your query structure as you build it
    - **Real-time SQL Preview**: Watch the generated SQL update in real-time
    - **Error Prevention**: The UI prevents syntactically invalid queries
    - **Saved Datasets**: Save and reuse query results as virtual tables

    ---

    ## Features

    ### Database and Table Selection

    Select your data source through a hierarchical selection system:

    1. **Project Selection**: Choose the BigQuery project
    2. **Dataset Selection**: Select a dataset within the project
    3. **Table Selection**: Pick a table or saved dataset to query

    The system supports:
    - Regular BigQuery tables
    - Saved datasets (previously saved query results)
    - Cross-database joins (Table 2 can be from a different database)

    ---

    ### Filter System

    Apply WHERE clause conditions to filter your data:

    #### Filter Components
    - **Column**: Select which column to filter on
    - **Operator**: Choose from various comparison operators
    - **Value**: Specify the filter value (direct or derived)

    #### Supported Operators

    | Category | Operators |
    |----------|-----------|
    | Comparison | `=`, `!=`, `>`, `<`, `>=`, `<=` |
    | Text | `LIKE`, `NOT LIKE`, `STARTS WITH`, `ENDS WITH` |
    | List | `IN`, `NOT IN` |
    | Range | `BETWEEN` |
    | Null | `IS NULL`, `IS NOT NULL` |

    #### Value Types

    1. **Direct Values**: Enter specific values (numbers, text, dates)
    2. **Derived Values**: Use aggregation functions or values from other tables
    - Aggregations: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`
    - Database lookup: Select a value from another table

    #### Filter Chaining

    Combine multiple filters using:
    - **AND**: All conditions must be true
    - **OR**: Any condition can be true
    - **Chain Groups**: Group conditions with parentheses for complex logic

    ---

    ### Select Columns

    Choose which columns to include in your query output:

    - **All Columns**: Select `*` to include everything
    - **Specific Columns**: Pick individual columns to include
    - **Column filtering affects**: ORDER BY options, JOIN match conditions, and final output

    When GROUP BY is enabled, the Select Columns section is replaced by GROUP BY and Aggregation columns.

    ---

    ### GROUP BY

    Group your data by one or more columns for aggregation:

    #### How to Use
    1. Enable the **Group By** toggle
    2. Click **Add Group By** to add grouping columns
    3. Select columns to group by

    #### Behavior
    - Enabling GROUP BY automatically enables Aggregation mode
    - Only GROUP BY columns and aggregation outputs appear in:
    - ORDER BY dropdown
    - JOIN match conditions
    - Select columns in JOIN section

    ---

    ### Aggregation Functions

    Perform calculations on grouped data:

    #### Available Functions

    | Function | Description | Supported Types |
    |----------|-------------|-----------------|
    | `COUNT` | Count of rows | All types |
    | `COUNT DISTINCT` | Count of unique values | All types |
    | `SUM` | Sum of values | Numeric only |
    | `AVG` | Average value | Numeric only |
    | `MIN` | Minimum value | All types |
    | `MAX` | Maximum value | All types |
    | `ANY_VALUE` | Any value from group (BigQuery) | All types |

    #### Aggregation Components
    - **Column**: Select the column to aggregate (or `*` for COUNT)
    - **Function**: Choose the aggregation function
    - **Alias**: Optional name for the output column

    ---

    ### HAVING Clause

    Filter groups after aggregation (similar to WHERE but for aggregated data):

    #### Available When
    - At least one aggregation column is defined

    #### Operators
    - `>`, `<`, `>=`, `<=`, `=`, `!=`, `BETWEEN`

    #### Example
    ```sql
    HAVING COUNT(*) > 10 AND SUM(amount) >= 1000
    ```

    #### Syntax Notes
    - `COUNT DISTINCT` generates proper syntax: `COUNT(DISTINCT column)`
    - Supports chaining with AND/OR operators

    ---

    ### ORDER BY

    Sort your query results by one or more columns:

    #### Features
    - **Multiple Columns**: Add unlimited ORDER BY columns
    - **Direction**: Choose `ASC` (ascending) or `DESC` (descending) for each
    - **Smart Column Options**:
    - When GROUP BY is enabled: Shows only GROUP BY columns + aggregation outputs
    - When GROUP BY is disabled: Shows only selected columns (or all if none selected)

    #### Adding Columns
    - Click the `+` button to add ORDER BY columns
    - Use the "Add Column" button at the bottom of the list for additional columns

    ---

    ### LIMIT

    Restrict the number of rows returned:

    - **Enable/Disable**: Toggle to enable LIMIT clause
    - **Value**: Specify maximum number of rows (0-10,000)
    - **Default Preview Limit**: Preview queries default to 100 rows when LIMIT is not explicitly set

    ---

    ### Multi-Table Support

    Work with two tables simultaneously for JOIN operations:

#### Table 2 Toggle
- **Add Table 2**: Click the `+ Add Table` button in the divider
- **Remove Table 2**: Click the `× Remove Table` button to remove

    When Table 2 is removed:
    - All Table 2 configuration is reset
    - JOIN section is hidden
    - Query reverts to single-table mode

    #### Cross-Database Support
    Table 2 can be from a different BigQuery project/dataset than Table 1.

    ---

    ### JOIN Operations

    Combine data from two tables:

    #### Supported JOIN Types

    | Type | Description |
    |------|-------------|
    | `INNER JOIN` | Only matching rows from both tables |
    | `LEFT JOIN` | All rows from Table 1, matching from Table 2 |
    | `RIGHT JOIN` | All rows from Table 2, matching from Table 1 |
    | `FULL OUTER JOIN` | All rows from both tables |
    | `CROSS JOIN` | Cartesian product of both tables |

    #### Match Conditions
    Define how tables are connected:
    - **Multiple Conditions**: Add multiple join conditions
    - **Operators**: AND/OR between conditions
    - **Column Options**: Respects GROUP BY and Select Columns settings

    #### Post-Join Filters
    Apply additional filters after the JOIN operation.

    #### Select Columns (JOIN)
    Choose which columns from each table to include in the final output.

    ---

    ### SQL Preview

    Real-time preview of the generated SQL query:

    #### Features
    - **Live Updates**: SQL updates as you modify the query
    - **Syntax Highlighting**: Formatted for readability
    - **Copy to Clipboard**: Copy the generated SQL
    - **Execute Query**: Run the query directly

    #### Query Structure
    The builder generates CTE-based queries:
    ```sql
    WITH
    table1_filtered AS (
        SELECT columns
        FROM `project.dataset.table1`
        WHERE conditions
        GROUP BY columns
        HAVING conditions
    ),
    table2_filtered AS (
        SELECT columns
        FROM `project.dataset.table2`
        WHERE conditions
    )
    SELECT columns
    FROM table1_filtered t1
    INNER JOIN table2_filtered t2 ON t1.key = t2.key
    ORDER BY column ASC
    LIMIT 100
    ```

    ---

    ### Save Dataset

    Save query results as reusable virtual tables:

    #### How to Save
    1. Build your query
    2. Click the **Save** button
    3. Enter a name for the dataset
    4. The saved dataset appears in the table selection dropdown

    #### Using Saved Datasets
    - Select saved datasets just like regular tables
    - Apply additional filters on top of saved queries
    - Chain saved datasets for complex workflows

    ---

    ## Architecture

    ### Component Structure

    ```
    SQLBuilder/
    ├── SQLBuilder.jsx           # Main component
    ├── components/
    │   ├── TableCard.jsx        # Table configuration card
    │   ├── JoinSection.jsx      # JOIN configuration
    │   ├── SQLPreview.jsx       # SQL preview panel
    │   ├── FilterValueInput.jsx # Filter value input component
    │   └── HintModal.jsx        # Help modals
    ├── hooks/
    │   ├── useSQLBuilder.js     # Main state management
    │   ├── useSQLGeneration.js  # SQL generation logic
    │   └── useQueryExecution.js # Query execution
    ├── utils/
    │   └── sqlHelpers.js        # SQL building utilities
    └── README.md                # This file
    ```

    ### State Management

    The SQL Builder uses React hooks for state management:

    - **useSQLBuilder**: Manages all UI state (selections, filters, columns, etc.)
    - **useSQLGeneration**: Converts state into SQL strings
    - **useQueryExecution**: Handles query execution and results

    ### Key Concepts

    #### Effective Columns
    The system computes "effective columns" based on the current state:
    - **GROUP BY enabled**: GROUP BY columns + Aggregation outputs
    - **GROUP BY disabled**: Selected columns (or all if none selected)

    These effective columns are used for:
    - ORDER BY dropdown options
    - JOIN match condition options
    - JOIN select column options

    #### CTE Generation
    All queries use Common Table Expressions (CTEs) for:
    - Better readability
    - Easier debugging
    - Support for complex subqueries
    - Saved dataset chaining

    ---

    ## Usage Guide

    ### Basic Query (Single Table)

    1. Select a **Database** and **Dataset**
    2. Choose a **Table**
    3. (Optional) Select specific **Columns**
    4. (Optional) Add **Filters**
    5. (Optional) Add **ORDER BY**
    6. Click **Run** to execute

    ### Aggregation Query

    1. Select your table
    2. Enable **Group By** toggle
    3. Add columns to group by
    4. Enable **Aggregation** toggle
    5. Add aggregation functions (COUNT, SUM, etc.)
    6. (Optional) Add **HAVING** conditions
    7. Configure **ORDER BY** with aggregation columns

    ### JOIN Query

    1. Configure **Table 1** (filters, columns, etc.)
    2. Click **+ Add Second Table**
    3. Configure **Table 2**
    4. In the **JOIN Section**:
    - Select JOIN type
    - Add match conditions
    - Select output columns
    5. (Optional) Add post-join filters
    6. Click **Run** to execute

    ### Save and Reuse

    1. Build and test your query
    2. Click **Save Dataset**
    3. Enter a descriptive name
    4. Use the saved dataset in future queries as a table

    ---

    ## Best Practices

    1. **Start Simple**: Begin with basic filters before adding aggregations
    2. **Use Aliases**: Give aggregations meaningful names
    3. **Limit Results**: Always use LIMIT during development
    4. **Preview SQL**: Check the generated SQL before executing
    5. **Save Intermediate Results**: Use saved datasets for complex workflows

    ---

    ## Troubleshooting

    ### Common Issues

    | Issue | Solution |
    |-------|----------|
    | ORDER BY shows wrong columns | Check GROUP BY state - columns change based on mode |
    | HAVING not working | Ensure you have at least one aggregation defined |
    | JOIN columns not appearing | Verify both tables have matching column types |
    | Query too slow | Add LIMIT, optimize filters, check table sizes |

    ---

    ## Version History

    ### Latest Updates
    - **COUNT DISTINCT Fix**: Corrected SQL syntax from `COUNT_DISTINCT(col)` to `COUNT(DISTINCT col)`
    - **Unlimited ORDER BY**: Removed column limit, added "Add Column" button
    - **Table 2 Toggle**: Added ability to add/remove Table 2 with dedicated buttons
    - **Smart Column Filtering**: ORDER BY and JOIN now respect GROUP BY and Select Columns settings

