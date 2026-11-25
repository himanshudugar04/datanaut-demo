"""Generates the demo warehouse (all data is synthetic).

Catalog `datanaut` mirrors the BigQuery layout project.dataset.table:
  datanaut.sales.customers      50,000 rows
  datanaut.sales.products        2,000 rows
  datanaut.sales.orders        500,000 rows
  datanaut.sales.order_items    ~900,000 rows
  datanaut.marketing.campaigns     300 rows
  datanaut.marketing.app_events 2,500,000 rows
"""

CITIES = [
    ("Mumbai", "Maharashtra"), ("Delhi", "Delhi"), ("Bengaluru", "Karnataka"),
    ("Hyderabad", "Telangana"), ("Chennai", "Tamil Nadu"), ("Kolkata", "West Bengal"),
    ("Pune", "Maharashtra"), ("Ahmedabad", "Gujarat"), ("Jaipur", "Rajasthan"),
    ("Lucknow", "Uttar Pradesh"), ("Kanpur", "Uttar Pradesh"), ("Indore", "Madhya Pradesh"),
    ("Bhopal", "Madhya Pradesh"), ("Chandigarh", "Chandigarh"), ("Kochi", "Kerala"),
    ("Coimbatore", "Tamil Nadu"), ("Nagpur", "Maharashtra"), ("Surat", "Gujarat"),
    ("Patna", "Bihar"), ("Guwahati", "Assam"),
]
FIRST = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan",
         "Rohan", "Ananya", "Diya", "Saanvi", "Aadhya", "Kavya", "Isha", "Meera", "Riya",
         "Priya", "Neha", "Rahul", "Karan", "Siddharth", "Nikhil", "Pooja", "Sneha", "Tanvi",
         "Varun", "Yash", "Zoya", "Aman", "Divya", "Harsh", "Kriti", "Manav", "Nisha"]
LAST = ["Sharma", "Verma", "Gupta", "Agarwal", "Iyer", "Reddy", "Nair", "Menon", "Patel",
        "Shah", "Mehta", "Joshi", "Kulkarni", "Deshmukh", "Singh", "Chauhan", "Rao", "Das",
        "Bose", "Mukherjee", "Khan", "Kapoor", "Malhotra", "Bansal", "Jain", "Dugar"]
CATEGORIES = {
    "Electronics": ["Volta", "Nimbus", "Zentra", "Pixelo"],
    "Fashion": ["Urbanloom", "Kurta Co", "Threadline", "Saffron"],
    "Home & Kitchen": ["Homely", "Kitchenwise", "Nestora", "Brew & Co"],
    "Beauty": ["Glowra", "Herbique", "Lumière", "PureLeaf"],
    "Grocery": ["FarmFresh", "DailyBasket", "Organica", "Spice Route"],
    "Sports": ["Stride", "Peakform", "Kinetic", "Courtside"],
    "Books": ["Inkwell", "PageTurn", "Folio", "Readwise"],
}
PRODUCT_WORDS = {
    "Electronics": ["Wireless Earbuds", "Smartwatch", "Power Bank", "Bluetooth Speaker", "USB-C Charger", "Laptop Stand", "Webcam", "Keyboard"],
    "Fashion": ["Cotton Kurta", "Denim Jacket", "Running Shoes", "Linen Shirt", "Silk Saree", "Sneakers", "Hoodie", "Chinos"],
    "Home & Kitchen": ["Air Fryer", "Pressure Cooker", "Bedsheet Set", "Table Lamp", "Water Bottle", "Coffee Maker", "Cushion Cover", "Knife Set"],
    "Beauty": ["Face Serum", "Sunscreen SPF50", "Hair Oil", "Lip Balm", "Face Wash", "Moisturiser", "Shampoo", "Perfume"],
    "Grocery": ["Basmati Rice 5kg", "Masala Chai", "Almonds 500g", "Cold Pressed Oil", "Honey", "Dark Chocolate", "Green Tea", "Oats"],
    "Sports": ["Yoga Mat", "Dumbbell Pair", "Cricket Bat", "Football", "Badminton Racket", "Skipping Rope", "Gym Gloves", "Cycling Helmet"],
    "Books": ["Data Science Handbook", "Indian History Atlas", "Startup Playbook", "Mystery Novel", "SQL Pocket Guide", "Poetry Collection", "Cookbook", "Biography"],
}


def _sql_list(values):
    return "[" + ", ".join("'" + v.replace("'", "''") + "'" for v in values) + "]"


def build(con, scale=1.0):
    n_customers = int(50_000 * scale)
    n_orders = int(500_000 * scale)
    n_events = int(2_500_000 * scale)

    # deterministic pseudo-random in [0,1): same data on every server instance
    con.execute("CREATE OR REPLACE MACRO rnd(k, tag) AS (hash(k, tag) % 1000003) / 1000003.0")
    con.execute("CREATE SCHEMA IF NOT EXISTS datanaut.sales")
    con.execute("CREATE SCHEMA IF NOT EXISTS datanaut.marketing")
    con.execute("CREATE SCHEMA IF NOT EXISTS datanaut.saved_tables")

    cities = _sql_list([c for c, _ in CITIES])
    states = _sql_list([s for _, s in CITIES])
    first = _sql_list(FIRST)
    last = _sql_list(LAST)

    # ---------------- customers ----------------
    con.execute(f"""
    CREATE OR REPLACE TABLE datanaut.sales.customers AS
    WITH base AS (
      SELECT i AS customer_id,
             1 + CAST(floor(rnd(i,'ci')*{len(CITIES)}) AS INT) AS ci,
             1 + CAST(floor(rnd(i,'fi')*{len(FIRST)}) AS INT) AS fi,
             1 + CAST(floor(rnd(i,'li')*{len(LAST)}) AS INT) AS li,
             rnd(i,'r1') AS r1, rnd(i,'r2') AS r2, rnd(i,'r3') AS r3
      FROM range(1, {n_customers}+1) t(i)
    )
    SELECT customer_id,
           {first}[fi] || ' ' || {last}[li] AS full_name,
           lower({first}[fi]) || '.' || lower({last}[li]) || customer_id || '@example.com' AS email,
           {cities}[ci] AS city,
           {states}[ci] AS state,
           CAST(DATE '2021-01-01' + CAST(floor(r1*1640) AS INT) AS DATE) AS signup_date,
           CASE WHEN r2 < 0.70 THEN 'Consumer' WHEN r2 < 0.93 THEN 'Small Business' ELSE 'Enterprise' END AS segment,
           r3 < 0.18 AS is_premium,
           18 + CAST(floor(rnd(customer_id,'age')*50) AS INT) AS age
    FROM base
    """)

    # ---------------- products ----------------
    prod_rows = []
    pid = 1
    for cat, brands in CATEGORIES.items():
        for word in PRODUCT_WORDS[cat]:
            for b in brands:
                prod_rows.append((cat, b, word))
    # expand to ~2000 products with variants
    con.execute("CREATE OR REPLACE TEMP TABLE _pbase(category VARCHAR, brand VARCHAR, item VARCHAR)")
    con.executemany("INSERT INTO _pbase VALUES (?, ?, ?)", prod_rows)
    con.execute("""
    CREATE OR REPLACE TABLE datanaut.sales.products AS
    WITH v AS (
      SELECT p.*, x.variant FROM _pbase p,
      (SELECT unnest(['Lite','Classic','Plus','Pro','Max','Mini','Eco','Prime','Gold','Neo','Air']) AS variant) x
    )
    SELECT CAST(row_number() OVER (ORDER BY category, brand, item, variant) AS INT) AS product_id,
           brand || ' ' || item || ' ' || variant AS product_name,
           category, brand,
           round(CASE category
                   WHEN 'Electronics' THEN 799 + rnd(category||brand||item||variant,'price')*14000
                   WHEN 'Fashion' THEN 299 + rnd(category||brand||item||variant,'price')*4500
                   WHEN 'Home & Kitchen' THEN 199 + rnd(category||brand||item||variant,'price')*7000
                   WHEN 'Beauty' THEN 149 + rnd(category||brand||item||variant,'price')*1800
                   WHEN 'Grocery' THEN 49 + rnd(category||brand||item||variant,'price')*900
                   WHEN 'Sports' THEN 199 + rnd(category||brand||item||variant,'price')*5000
                   ELSE 149 + rnd(category||brand||item||variant,'price')*1200 END, 2) AS unit_price,
           CAST(DATE '2020-06-01' + CAST(floor(rnd(category||brand||item||variant,'launch')*1800) AS INT) AS DATE) AS launch_date,
           rnd(category||brand||item||variant,'active') < 0.92 AS is_active
    FROM v
    """)
    n_products = con.execute("SELECT count(*) FROM datanaut.sales.products").fetchone()[0]

    # ---------------- orders + order_items ----------------
    con.execute(f"""
    CREATE OR REPLACE TEMP TABLE _obase AS
    SELECT i AS order_id,
           1 + CAST(floor(rnd(i,'cust')*{n_customers}) AS INT) AS customer_id,
           TIMESTAMP '2023-01-01' + to_seconds(CAST(floor(rnd(i,'ts')*94608000) AS BIGINT)) AS order_ts,
           1 + CAST(floor(rnd(i,'n1')*rnd(i,'n2')*5) AS INT) AS n_items,
           rnd(i,'rs') AS rs, rnd(i,'rp') AS rp, rnd(i,'rc') AS rc, rnd(i,'rd') AS rd
    FROM range(1, {n_orders}+1) t(i)
    """)
    con.execute(f"""
    CREATE OR REPLACE TABLE datanaut.sales.order_items AS
    SELECT o.order_id * 10 + o.k AS order_item_id,
           o.order_id,
           p.product_id,
           1 + CAST(floor(rnd(o.order_id*10+o.k,'q1')*rnd(o.order_id*10+o.k,'q2')*4) AS INT) AS quantity,
           p.unit_price
    FROM (
      SELECT order_id, r.range AS k, 1 + CAST(floor(rnd(order_id*10 + r.range,'pid')*{n_products}) AS INT) AS pid
      FROM _obase, range(n_items) r
    ) o
    JOIN datanaut.sales.products p ON p.product_id = o.pid
    """)
    con.execute("ALTER TABLE datanaut.sales.order_items ADD COLUMN line_total DOUBLE")
    con.execute("UPDATE datanaut.sales.order_items SET line_total = round(quantity*unit_price, 2)")
    con.execute("""
    CREATE OR REPLACE TABLE datanaut.sales.orders AS
    WITH agg AS (
      SELECT order_id, sum(line_total) AS gross, count(*) AS items_count
      FROM datanaut.sales.order_items GROUP BY order_id
    )
    SELECT o.order_id,
           o.customer_id,
           CAST(o.order_ts AS DATE) AS order_date,
           o.order_ts,
           CASE WHEN o.rs < 0.78 THEN 'Delivered' WHEN o.rs < 0.86 THEN 'Shipped'
                WHEN o.rs < 0.94 THEN 'Cancelled' ELSE 'Returned' END AS status,
           CASE WHEN o.rp < 0.48 THEN 'UPI' WHEN o.rp < 0.68 THEN 'Card' WHEN o.rp < 0.84 THEN 'Cash on Delivery'
                WHEN o.rp < 0.94 THEN 'Net Banking' ELSE 'Wallet' END AS payment_method,
           CASE WHEN o.rc < 0.62 THEN 'App' WHEN o.rc < 0.92 THEN 'Web' ELSE 'Store' END AS channel,
           c.city,
           a.items_count,
           round(a.gross, 2) AS gross_amount,
           round(CASE WHEN o.rd < 0.35 THEN a.gross * (0.05 + o.rd/3) ELSE 0 END, 2) AS discount,
           round(a.gross - CASE WHEN o.rd < 0.35 THEN a.gross * (0.05 + o.rd/3) ELSE 0 END, 2) AS total_amount
    FROM _obase o
    JOIN agg a USING (order_id)
    JOIN datanaut.sales.customers c USING (customer_id)
        """)

    # ---------------- campaigns ----------------
    con.execute("""
    CREATE OR REPLACE TABLE datanaut.marketing.campaigns AS
    WITH b AS (
      SELECT i AS campaign_id, rnd(i,'c1') AS r1, rnd(i,'c2') AS r2, rnd(i,'c3') AS r3,
             CAST(DATE '2023-01-01' + CAST(floor(rnd(i,'cs')*1050) AS INT) AS DATE) AS start_date
      FROM range(1, 301) t(i)
    )
    SELECT campaign_id,
           (['Diwali Dhamaka','Monsoon Sale','New Year Bash','Summer Splash','Republic Day Deals','Holi Hues',
             'Back to College','Weekend Flash','Festive Fiesta','Clearance Carnival'])[1 + CAST(floor(r1*10) AS INT)]
             || ' ' || campaign_id AS campaign_name,
           (['Email','SMS','Push','Google Ads','Instagram','YouTube'])[1 + CAST(floor(r2*6) AS INT)] AS channel,
           start_date,
           CAST(start_date + 7 + CAST(floor(r3*30) AS INT) AS DATE) AS end_date,
           round(50000 + r1*950000, 0) AS budget,
           round((50000 + r1*950000) * (0.6 + r3*0.45), 0) AS spend,
           CAST(100000 + r2*4900000 AS BIGINT) AS impressions,
           CAST((100000 + r2*4900000) * (0.008 + r3*0.04) AS BIGINT) AS clicks,
           CAST((100000 + r2*4900000) * (0.008 + r3*0.04) * (0.02 + r1*0.08) AS BIGINT) AS conversions
    FROM b
    """)

    # ---------------- app_events ----------------
    con.execute(f"""
    CREATE OR REPLACE TABLE datanaut.marketing.app_events AS
    WITH b AS (
      SELECT i AS event_id,
             1 + CAST(floor(rnd(i,'ec')*{n_customers}) AS INT) AS customer_id,
             TIMESTAMP '2024-01-01' + to_seconds(CAST(floor(rnd(i,'et')*63072000) AS BIGINT)) AS event_ts,
             rnd(i,'re') AS re, rnd(i,'es') AS rs, rnd(i,'ed') AS rd, rnd(i,'ev') AS rv
      FROM range(1, {n_events}+1) t(i)
    ), e AS (
      SELECT *,
        CASE WHEN re < 0.22 THEN 'app_open' WHEN re < 0.40 THEN 'search' WHEN re < 0.62 THEN 'view_product'
             WHEN re < 0.74 THEN 'add_to_cart' WHEN re < 0.82 THEN 'checkout_started' WHEN re < 0.88 THEN 'payment_success'
             WHEN re < 0.91 THEN 'payment_failed' WHEN re < 0.96 THEN 'coupon_applied' ELSE 'logout' END AS event_name
      FROM b
    )
    SELECT e.event_id,
           e.customer_id,
           e.event_name,
           e.event_ts,
           CAST(e.event_ts AS DATE) AS event_date,
           CASE WHEN e.event_name IN ('payment_success','payment_failed','checkout_started') AND e.rs < 0.7 THEN 'API' ELSE 'APP' END AS source,
           CASE WHEN e.event_name LIKE 'payment%' THEN 'payments' WHEN e.event_name = 'checkout_started' THEN 'orders' ELSE 'client' END AS data_src,
           CASE WHEN e.rd < 0.71 THEN 'Android' WHEN e.rd < 0.93 THEN 'iOS' ELSE 'Web' END AS device,
           '5.' || CAST(floor(e.rv*9) AS INT) || '.' || CAST(floor(e.rv*97) % 10 AS INT) AS app_version,
           c.city,
           'S' || lpad(CAST(e.customer_id AS VARCHAR), 6, '0') || '-' || CAST(epoch(e.event_ts)//1800 AS BIGINT) AS session_id,
           CASE e.event_name
             WHEN 'search' THEN '{{"query": "' || (['earbuds','kurta','air fryer','sunscreen','yoga mat','rice','novel'])[1 + CAST(floor(e.rv*7) AS INT)] || '", "results": ' || CAST(floor(e.rv*120) AS INT) || '}}'
             WHEN 'view_product' THEN '{{"product_id": ' || (1 + CAST(floor(e.rv*{n_products}) AS INT)) || ', "position": ' || (1 + CAST(floor(e.rs*20) AS INT)) || '}}'
             WHEN 'add_to_cart' THEN '{{"product_id": ' || (1 + CAST(floor(e.rv*{n_products}) AS INT)) || ', "quantity": ' || (1 + CAST(floor(e.rs*3) AS INT)) || '}}'
             WHEN 'payment_success' THEN '{{"amount": ' || round(199 + e.rv*9000, 2) || ', "method": "UPI"}}'
             WHEN 'payment_failed' THEN '{{"amount": ' || round(199 + e.rv*9000, 2) || ', "error": "BANK_TIMEOUT"}}'
             WHEN 'coupon_applied' THEN '{{"coupon": "SAVE' || (5 + CAST(floor(e.rv*6) AS INT)*5) || '"}}'
             ELSE '{{"screen": "home"}}' END AS event_params
    FROM e JOIN datanaut.sales.customers c USING (customer_id)
        """)
    con.execute("DROP TABLE IF EXISTS _obase")
    con.execute("DROP TABLE IF EXISTS _pbase")


TABLE_DESCRIPTIONS = {
    ("sales", "customers"): "Customer master: profile, city, segment and premium flag.",
    ("sales", "products"): "Product catalog across 7 categories with list prices.",
    ("sales", "orders"): "One row per order with status, payment method, channel and amounts.",
    ("sales", "order_items"): "Order line items linking orders to products.",
    ("marketing", "campaigns"): "Marketing campaigns with budget, spend, impressions, clicks and conversions.",
    ("marketing", "app_events"): "Clickstream events from the app and backend APIs.",
}
