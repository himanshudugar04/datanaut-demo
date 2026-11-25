import { useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

/**
 * HintModal - A scrollable modal that closes when clicking outside
 */
const HintModal = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden"; // Prevent body scroll
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = ""; // Restore body scroll
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="hint-modal__overlay">
      <div className="hint-modal" ref={modalRef}>
        <div className="hint-modal__header">
          <h3>{title}</h3>
          <button className="hint-modal__close" onClick={onClose}>
            <XMarkIcon />
          </button>
        </div>
        <div className="hint-modal__content">
          {children}
        </div>
      </div>
    </div>
  );
};

// AND/OR Modal Content
export const AndOrContent = ({ type }) => {
  if (type === "AND") {
    return (
      <div className="hint-modal__body">
        <h4>AND - All conditions must match</h4>
        
        <div className="hint-modal__section">
          <p>When you use <strong>AND</strong>, <em>both</em> conditions must be true for a row to appear in the results.</p>
        </div>

        <div className="hint-modal__section">
          <h5>Example Table: users</h5>
          <table className="hint-modal__table">
            <thead>
              <tr><th>id</th><th>name</th><th>city</th></tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Aarav</td><td>Mumbai</td></tr>
              <tr><td>2</td><td>Sneha</td><td>Kolkata</td></tr>
              <tr><td>3</td><td>Raj</td><td>Mumbai</td></tr>
            </tbody>
          </table>
        </div>

        <div className="hint-modal__section">
          <h5>Query with AND:</h5>
          <pre className="hint-modal__code">WHERE city = 'Mumbai' AND name = 'Aarav'</pre>
        </div>

        <div className="hint-modal__section">
          <h5>Output:</h5>
          <table className="hint-modal__table hint-modal__table--result">
            <thead>
              <tr><th>id</th><th>name</th><th>city</th></tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Aarav</td><td>Mumbai</td></tr>
            </tbody>
          </table>
          <p className="hint-modal__note">Only Aarav from Mumbai is shown. Raj is in Mumbai but his name is not 'Aarav', so he's excluded.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hint-modal__body">
      <h4>OR - Any condition can match</h4>
      
      <div className="hint-modal__section">
        <p>When you use <strong>OR</strong>, <em>either</em> condition can be true for a row to appear in the results.</p>
      </div>

      <div className="hint-modal__section">
        <h5>Example Table: users</h5>
        <table className="hint-modal__table">
          <thead>
            <tr><th>id</th><th>name</th><th>city</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Aarav</td><td>Mumbai</td></tr>
            <tr><td>2</td><td>Sneha</td><td>Kolkata</td></tr>
            <tr><td>3</td><td>Raj</td><td>Mumbai</td></tr>
          </tbody>
        </table>
      </div>

      <div className="hint-modal__section">
        <h5>Query with OR:</h5>
        <pre className="hint-modal__code">WHERE city = 'Mumbai' OR name = 'Sneha'</pre>
      </div>

      <div className="hint-modal__section">
        <h5>Output:</h5>
        <table className="hint-modal__table hint-modal__table--result">
          <thead>
            <tr><th>id</th><th>name</th><th>city</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Aarav</td><td>Mumbai</td></tr>
            <tr><td>2</td><td>Sneha</td><td>Kolkata</td></tr>
            <tr><td>3</td><td>Raj</td><td>Mumbai</td></tr>
          </tbody>
        </table>
        <p className="hint-modal__note">All three rows match! Aarav and Raj are in Mumbai. Sneha matches by name even though she's in Kolkata.</p>
      </div>
    </div>
  );
};

// Join Type Modal Content
export const JoinTypeContent = ({ type }) => {
  const exampleTables = (
    <div className="hint-modal__section">
      <h5>We'll use the following two tables:</h5>
      <div className="hint-modal__tables-row">
        <div>
          <h6>users table</h6>
          <table className="hint-modal__table">
            <thead>
              <tr><th>id</th><th>name</th></tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Aarav</td></tr>
              <tr><td>2</td><td>Sneha</td></tr>
              <tr><td>3</td><td>Raj</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h6>addresses table</h6>
          <table className="hint-modal__table">
            <thead>
              <tr><th>id</th><th>user_id</th><th>city</th></tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>1</td><td>Mumbai</td></tr>
              <tr><td>2</td><td>2</td><td>Kolkata</td></tr>
              <tr><td>3</td><td>4</td><td>Delhi</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (type === "INNER JOIN") {
    return (
      <div className="hint-modal__body">
        <h4>INNER JOIN</h4>
        <p className="hint-modal__subtitle">Returns only the matching rows from both tables.</p>
        
        {exampleTables}

        <div className="hint-modal__section">
          <h5>SQL Query:</h5>
          <pre className="hint-modal__code">{`SELECT users.name, addresses.city
FROM users
INNER JOIN addresses ON users.id = addresses.user_id;`}</pre>
        </div>

        <div className="hint-modal__section">
          <h5>Visual Representation:</h5>
          <pre className="hint-modal__diagram">{`users          addresses
  id             user_id
-----          ---------
| 1 |  ←────→  |   1   |  ✓ Match (Aarav - Mumbai)
| 2 |  ←────→  |   2   |  ✓ Match (Sneha - Kolkata)
| 3 |          |   4   |  ✗ No match
               
Only matching pairs are included.`}</pre>
        </div>

        <div className="hint-modal__section">
          <h5>Output:</h5>
          <table className="hint-modal__table hint-modal__table--result">
            <thead>
              <tr><th>name</th><th>city</th></tr>
            </thead>
            <tbody>
              <tr><td>Aarav</td><td>Mumbai</td></tr>
              <tr><td>Sneha</td><td>Kolkata</td></tr>
            </tbody>
          </table>
          <p className="hint-modal__note">
            <strong>Raj</strong> is excluded because there is no matching address (no user_id = 3 in addresses).<br/>
            <strong>Delhi</strong> is excluded because its user_id (4) is not in users.
          </p>
        </div>
      </div>
    );
  }

  if (type === "LEFT JOIN") {
    return (
      <div className="hint-modal__body">
        <h4>LEFT JOIN</h4>
        <p className="hint-modal__subtitle">Returns all rows from the left table (users), and matching rows from the right table (addresses). If no match is found, NULLs are returned.</p>
        
        {exampleTables}

        <div className="hint-modal__section">
          <h5>SQL Query:</h5>
          <pre className="hint-modal__code">{`SELECT users.name, addresses.city
FROM users
LEFT JOIN addresses ON users.id = addresses.user_id;`}</pre>
        </div>

        <div className="hint-modal__section">
          <h5>Visual Representation:</h5>
          <pre className="hint-modal__diagram">{`users          addresses
  id             user_id
-----          ---------
| 1 |  ←────→  |   1   |  ✓ Match (Aarav - Mumbai)
| 2 |  ←────→  |   2   |  ✓ Match (Sneha - Kolkata)
| 3 |  ←────→  |  ---  |  → Raj with NULL (no address)
               |   4   |  ✗ Delhi excluded (no user)
               
All left table rows are included.`}</pre>
        </div>

        <div className="hint-modal__section">
          <h5>Output:</h5>
          <table className="hint-modal__table hint-modal__table--result">
            <thead>
              <tr><th>name</th><th>city</th></tr>
            </thead>
            <tbody>
              <tr><td>Aarav</td><td>Mumbai</td></tr>
              <tr><td>Sneha</td><td>Kolkata</td></tr>
              <tr><td>Raj</td><td className="hint-modal__null">NULL</td></tr>
            </tbody>
          </table>
          <p className="hint-modal__note">
            <strong>Raj</strong> is shown even though he doesn't have an address (city is NULL).<br/>
            <strong>Delhi</strong> is excluded because we're keeping all users, not all addresses.
          </p>
        </div>
      </div>
    );
  }

  if (type === "RIGHT JOIN") {
    return (
      <div className="hint-modal__body">
        <h4>RIGHT JOIN</h4>
        <p className="hint-modal__subtitle">Returns all rows from the right table (addresses), and matching rows from the left table (users). If no match is found, NULLs are returned.</p>
        
        {exampleTables}

        <div className="hint-modal__section">
          <h5>SQL Query:</h5>
          <pre className="hint-modal__code">{`SELECT users.name, addresses.city
FROM users
RIGHT JOIN addresses ON users.id = addresses.user_id;`}</pre>
        </div>

        <div className="hint-modal__section">
          <h5>Visual Representation:</h5>
          <pre className="hint-modal__diagram">{`users          addresses
  id             user_id
-----          ---------
| 1 |  ←────→  |   1   |  ✓ Match (Aarav - Mumbai)
| 2 |  ←────→  |   2   |  ✓ Match (Sneha - Kolkata)
| 3 |          |   4   |  → NULL - Delhi (no user)
  ↑
  Raj excluded (no address)
               
All right table rows are included.`}</pre>
        </div>

        <div className="hint-modal__section">
          <h5>Output:</h5>
          <table className="hint-modal__table hint-modal__table--result">
            <thead>
              <tr><th>name</th><th>city</th></tr>
            </thead>
            <tbody>
              <tr><td>Aarav</td><td>Mumbai</td></tr>
              <tr><td>Sneha</td><td>Kolkata</td></tr>
              <tr><td className="hint-modal__null">NULL</td><td>Delhi</td></tr>
            </tbody>
          </table>
          <p className="hint-modal__note">
            <strong>Delhi</strong> is shown even though user_id 4 doesn't exist (name is NULL).<br/>
            <strong>Raj</strong> is excluded because we're keeping all addresses, not all users.
          </p>
        </div>
      </div>
    );
  }

  if (type === "FULL OUTER JOIN") {
    return (
      <div className="hint-modal__body">
        <h4>FULL OUTER JOIN</h4>
        <p className="hint-modal__subtitle">Returns all rows from both tables. If no match is found on either side, NULLs are returned.</p>
        
        {exampleTables}

        <div className="hint-modal__section">
          <h5>SQL Query:</h5>
          <pre className="hint-modal__code">{`SELECT users.name, addresses.city
FROM users
FULL OUTER JOIN addresses ON users.id = addresses.user_id;`}</pre>
        </div>

        <div className="hint-modal__section">
          <h5>Visual Representation:</h5>
          <pre className="hint-modal__diagram">{`users          addresses
  id             user_id
-----          ---------
| 1 |  ←────→  |   1   |  ✓ Match (Aarav - Mumbai)
| 2 |  ←────→  |   2   |  ✓ Match (Sneha - Kolkata)
| 3 |  ←────→  |  ---  |  → Raj with NULL city
|---|  ←────→  |   4   |  → NULL name with Delhi
               
ALL rows from BOTH tables are included.`}</pre>
        </div>

        <div className="hint-modal__section">
          <h5>Output:</h5>
          <table className="hint-modal__table hint-modal__table--result">
            <thead>
              <tr><th>name</th><th>city</th></tr>
            </thead>
            <tbody>
              <tr><td>Aarav</td><td>Mumbai</td></tr>
              <tr><td>Sneha</td><td>Kolkata</td></tr>
              <tr><td>Raj</td><td className="hint-modal__null">NULL</td></tr>
              <tr><td className="hint-modal__null">NULL</td><td>Delhi</td></tr>
            </tbody>
          </table>
          <p className="hint-modal__note">
            <strong>Everyone is included!</strong><br/>
            Raj appears with NULL city (no address).<br/>
            Delhi appears with NULL name (user_id 4 doesn't exist).
          </p>
        </div>
      </div>
    );
  }

  return null;
};

// Chain Modal Content
export const ChainContent = () => {
  return (
    <div className="hint-modal__body">
      <h4>Chain - Group filters with parentheses</h4>
      
      <div className="hint-modal__section">
        <p>The <strong>Chain</strong> button lets you control how filters are grouped using parentheses (brackets). This determines which conditions are evaluated together.</p>
      </div>

      <div className="hint-modal__section">
        <h5>Why does grouping matter?</h5>
        <p>Consider: <em>"Find orders from 2024 where country is India OR amount {'>'} 1000"</em></p>
        <p>Without proper grouping, you might get unexpected results!</p>
      </div>

      <div className="hint-modal__section">
        <h5>Example: 3 Filters without Chain</h5>
        <pre className="hint-modal__code">year = 2024 AND country = 'IN' OR amount {'>'} 1000</pre>
        <p className="hint-modal__note">This could be interpreted as: <code>(year = 2024 AND country = 'IN') OR amount {'>'} 1000</code> — meaning ANY order over 1000, even from other years!</p>
      </div>

      <div className="hint-modal__section">
        <h5>Example: Chain Filter 2 with Filter 3</h5>
        <p>Click the Chain button between Filter 2 and Filter 3:</p>
        <pre className="hint-modal__code">year = 2024 AND (country = 'IN' OR amount {'>'} 1000)</pre>
        <p className="hint-modal__note">Now it correctly means: Orders from 2024 where country is India OR amount is over 1000.</p>
      </div>

      <div className="hint-modal__section">
        <h5>Continuous Chaining</h5>
        <p>If you chain Filter 1→2 AND Filter 2→3, they all group together:</p>
        <pre className="hint-modal__code">(filter1 AND filter2 OR filter3)</pre>
      </div>

      <div className="hint-modal__section">
        <h5>Separate Groups</h5>
        <p>If you chain Filter 1→2 and separately chain Filter 3→4:</p>
        <pre className="hint-modal__code">(filter1 AND filter2) OR (filter3 AND filter4)</pre>
        <p className="hint-modal__note">Discontinuous chains create separate bracket groups.</p>
      </div>

      <div className="hint-modal__section">
        <h5>Tooltip Hint</h5>
        <p>Hover over the Chain button to see which filters will be grouped together when you click it.</p>
      </div>
    </div>
  );
};

// GROUP BY Modal Content
export const GroupByContent = () => {
  return (
    <div className="hint-modal__body">
      <h4>GROUP BY</h4>
      <p className="hint-modal__subtitle">Combine rows that have the same values into summary rows.</p>
      
      <div className="hint-modal__section">
        <h5>What is GROUP BY?</h5>
        <p><strong>GROUP BY</strong> organizes your data into groups based on one or more columns. Think of it like sorting papers into folders - all rows with the same value go into the same group.</p>
      </div>

      <div className="hint-modal__section">
        <h5>Example Table: orders</h5>
        <table className="hint-modal__table">
          <thead>
            <tr><th>id</th><th>region</th><th>product</th><th>amount</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>North</td><td>Laptop</td><td>1200</td></tr>
            <tr><td>2</td><td>South</td><td>Phone</td><td>800</td></tr>
            <tr><td>3</td><td>North</td><td>Tablet</td><td>500</td></tr>
            <tr><td>4</td><td>South</td><td>Laptop</td><td>1200</td></tr>
            <tr><td>5</td><td>North</td><td>Phone</td><td>800</td></tr>
          </tbody>
        </table>
      </div>

      <div className="hint-modal__section">
        <h5>Query: Group by region</h5>
        <pre className="hint-modal__code">{`SELECT region, COUNT(*) AS order_count
FROM orders
GROUP BY region`}</pre>
      </div>

      <div className="hint-modal__section">
        <h5>Visual Representation:</h5>
        <pre className="hint-modal__diagram">{`Original Data          After GROUP BY region
--------------          ---------------------
North, Laptop           North → 3 rows grouped
South, Phone            South → 2 rows grouped
North, Tablet
South, Laptop
North, Phone`}</pre>
      </div>

      <div className="hint-modal__section">
        <h5>Output:</h5>
        <table className="hint-modal__table hint-modal__table--result">
          <thead>
            <tr><th>region</th><th>order_count</th></tr>
          </thead>
          <tbody>
            <tr><td>North</td><td>3</td></tr>
            <tr><td>South</td><td>2</td></tr>
          </tbody>
        </table>
        <p className="hint-modal__note">
          <strong>Important:</strong> When using GROUP BY, you can only SELECT columns that are either in the GROUP BY clause or wrapped in an aggregation function (COUNT, SUM, AVG, etc.).
        </p>
      </div>

      <div className="hint-modal__section">
        <h5>When to Use GROUP BY</h5>
        <ul className="hint-modal__list">
          <li>Counting items per category (orders per customer)</li>
          <li>Summarizing data by time periods (sales per month)</li>
          <li>Comparing metrics across groups (average order value by region)</li>
        </ul>
      </div>
    </div>
  );
};

// Aggregation Modal Content (with HAVING)
export const AggregationContent = () => {
  return (
    <div className="hint-modal__body">
      <h4>Aggregation Functions</h4>
      <p className="hint-modal__subtitle">Perform calculations on multiple rows and return a single value.</p>
      
      <div className="hint-modal__section">
        <h5>Available Aggregation Functions</h5>
        <table className="hint-modal__table">
          <thead>
            <tr><th>Function</th><th>Description</th><th>Example</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>COUNT</strong></td><td>Counts the number of rows</td><td>COUNT(*) or COUNT(column)</td></tr>
            <tr><td><strong>SUM</strong></td><td>Adds up all values</td><td>SUM(amount)</td></tr>
            <tr><td><strong>AVG</strong></td><td>Calculates the average</td><td>AVG(price)</td></tr>
            <tr><td><strong>MIN</strong></td><td>Finds the smallest value</td><td>MIN(date)</td></tr>
            <tr><td><strong>MAX</strong></td><td>Finds the largest value</td><td>MAX(score)</td></tr>
          </tbody>
        </table>
      </div>

      <div className="hint-modal__section">
        <h5>Example Table: orders</h5>
        <table className="hint-modal__table">
          <thead>
            <tr><th>id</th><th>region</th><th>amount</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>North</td><td>100</td></tr>
            <tr><td>2</td><td>South</td><td>250</td></tr>
            <tr><td>3</td><td>North</td><td>150</td></tr>
            <tr><td>4</td><td>South</td><td>300</td></tr>
            <tr><td>5</td><td>North</td><td>200</td></tr>
          </tbody>
        </table>
      </div>

      <div className="hint-modal__section">
        <h5>Query with Aggregation:</h5>
        <pre className="hint-modal__code">{`SELECT region, 
       SUM(amount) AS total_sales,
       AVG(amount) AS avg_sale,
       COUNT(*) AS order_count
FROM orders
GROUP BY region`}</pre>
      </div>

      <div className="hint-modal__section">
        <h5>Output:</h5>
        <table className="hint-modal__table hint-modal__table--result">
          <thead>
            <tr><th>region</th><th>total_sales</th><th>avg_sale</th><th>order_count</th></tr>
          </thead>
          <tbody>
            <tr><td>North</td><td>450</td><td>150</td><td>3</td></tr>
            <tr><td>South</td><td>550</td><td>275</td><td>2</td></tr>
          </tbody>
        </table>
      </div>

      <div className="hint-modal__section">
        <h5>What is HAVING?</h5>
        <p><strong>HAVING</strong> filters groups AFTER aggregation (unlike WHERE which filters rows BEFORE grouping).</p>
      </div>

      <div className="hint-modal__section">
        <h5>HAVING Example:</h5>
        <pre className="hint-modal__code">{`SELECT region, SUM(amount) AS total_sales
FROM orders
GROUP BY region
HAVING SUM(amount) > 500`}</pre>
        <p className="hint-modal__note">This returns only regions where total sales exceed 500. South (550) is included, but North (450) is excluded.</p>
      </div>

      <div className="hint-modal__section">
        <h5>WHERE vs HAVING</h5>
        <table className="hint-modal__table">
          <thead>
            <tr><th>WHERE</th><th>HAVING</th></tr>
          </thead>
          <tbody>
            <tr><td>Filters individual rows</td><td>Filters groups</td></tr>
            <tr><td>Applied before GROUP BY</td><td>Applied after GROUP BY</td></tr>
            <tr><td>Cannot use aggregates</td><td>Can use aggregates</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ORDER BY Modal Content
export const OrderByContent = () => {
  return (
    <div className="hint-modal__body">
      <h4>ORDER BY</h4>
      <p className="hint-modal__subtitle">Sort your query results in a specific order.</p>
      
      <div className="hint-modal__section">
        <h5>What is ORDER BY?</h5>
        <p><strong>ORDER BY</strong> sorts the result set based on one or more columns. By default, sorting is ascending (A-Z, 0-9). Use DESC for descending order (Z-A, 9-0).</p>
      </div>

      <div className="hint-modal__section">
        <h5>Example Table: products</h5>
        <table className="hint-modal__table">
          <thead>
            <tr><th>id</th><th>name</th><th>price</th><th>category</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Laptop</td><td>1200</td><td>Electronics</td></tr>
            <tr><td>2</td><td>Phone</td><td>800</td><td>Electronics</td></tr>
            <tr><td>3</td><td>Desk</td><td>350</td><td>Furniture</td></tr>
            <tr><td>4</td><td>Chair</td><td>150</td><td>Furniture</td></tr>
          </tbody>
        </table>
      </div>

      <div className="hint-modal__section">
        <h5>Single Column Ordering:</h5>
        <pre className="hint-modal__code">{`SELECT * FROM products
ORDER BY price DESC`}</pre>
        <table className="hint-modal__table hint-modal__table--result">
          <thead>
            <tr><th>id</th><th>name</th><th>price</th><th>category</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Laptop</td><td>1200</td><td>Electronics</td></tr>
            <tr><td>2</td><td>Phone</td><td>800</td><td>Electronics</td></tr>
            <tr><td>3</td><td>Desk</td><td>350</td><td>Furniture</td></tr>
            <tr><td>4</td><td>Chair</td><td>150</td><td>Furniture</td></tr>
          </tbody>
        </table>
        <p className="hint-modal__note">Results sorted by price from highest to lowest (DESC).</p>
      </div>

      <div className="hint-modal__section">
        <h5>Multi-Column Ordering:</h5>
        <pre className="hint-modal__code">{`SELECT * FROM products
ORDER BY category ASC, price DESC`}</pre>
        <pre className="hint-modal__diagram">{`Step 1: Sort by category (ASC)
  Electronics → Laptop, Phone
  Furniture   → Desk, Chair

Step 2: Within each category, sort by price (DESC)
  Electronics → Laptop (1200), Phone (800)
  Furniture   → Desk (350), Chair (150)`}</pre>
        <p className="hint-modal__note">The first column is the primary sort. Additional columns break ties.</p>
      </div>

      <div className="hint-modal__section">
        <h5>ASC vs DESC</h5>
        <table className="hint-modal__table">
          <thead>
            <tr><th>Direction</th><th>Numbers</th><th>Text</th><th>Dates</th></tr>
          </thead>
          <tbody>
            <tr><td><strong>ASC</strong> (default)</td><td>1, 2, 3...</td><td>A, B, C...</td><td>Oldest first</td></tr>
            <tr><td><strong>DESC</strong></td><td>...3, 2, 1</td><td>...C, B, A</td><td>Newest first</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// LIMIT Modal Content
export const LimitContent = () => {
  return (
    <div className="hint-modal__body">
      <h4>LIMIT</h4>
      <p className="hint-modal__subtitle">Restrict the number of rows returned by your query.</p>
      
      <div className="hint-modal__section">
        <h5>What is LIMIT?</h5>
        <p><strong>LIMIT</strong> specifies the maximum number of rows to return. It's applied after all other operations (WHERE, GROUP BY, ORDER BY).</p>
      </div>

      <div className="hint-modal__section">
        <h5>Example Table: customers</h5>
        <table className="hint-modal__table">
          <thead>
            <tr><th>id</th><th>name</th><th>total_orders</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Aarav</td><td>45</td></tr>
            <tr><td>2</td><td>Sneha</td><td>32</td></tr>
            <tr><td>3</td><td>Raj</td><td>28</td></tr>
            <tr><td>4</td><td>Priya</td><td>21</td></tr>
            <tr><td>5</td><td>Vikram</td><td>15</td></tr>
          </tbody>
        </table>
      </div>

      <div className="hint-modal__section">
        <h5>Query: Top 3 customers</h5>
        <pre className="hint-modal__code">{`SELECT * FROM customers
ORDER BY total_orders DESC
LIMIT 3`}</pre>
      </div>

      <div className="hint-modal__section">
        <h5>Output:</h5>
        <table className="hint-modal__table hint-modal__table--result">
          <thead>
            <tr><th>id</th><th>name</th><th>total_orders</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>Aarav</td><td>45</td></tr>
            <tr><td>2</td><td>Sneha</td><td>32</td></tr>
            <tr><td>3</td><td>Raj</td><td>28</td></tr>
          </tbody>
        </table>
        <p className="hint-modal__note">Only the first 3 rows are returned after sorting.</p>
      </div>

      <div className="hint-modal__section">
        <h5>Common Use Cases</h5>
        <table className="hint-modal__table">
          <thead>
            <tr><th>Use Case</th><th>Example</th></tr>
          </thead>
          <tbody>
            <tr><td>Top N results</td><td>ORDER BY score DESC LIMIT 10</td></tr>
            <tr><td>Preview data</td><td>LIMIT 100 (see sample rows)</td></tr>
            <tr><td>Performance</td><td>LIMIT on large tables to avoid timeouts</td></tr>
            <tr><td>Latest records</td><td>ORDER BY date DESC LIMIT 5</td></tr>
          </tbody>
        </table>
      </div>

      <div className="hint-modal__section">
        <h5>Important Notes</h5>
        <ul className="hint-modal__list">
          <li>LIMIT 0 means no limit (return all rows)</li>
          <li>Always use ORDER BY with LIMIT to get consistent results</li>
          <li>Without ORDER BY, which rows are returned is unpredictable</li>
        </ul>
      </div>
    </div>
  );
};

// Legacy export for backward compatibility
export const OrderByLimitContent = OrderByContent;

export default HintModal;

