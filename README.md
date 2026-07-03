This is a professional README.md file tailored for your project. It highlights
the advanced architectural decisions you made, making it perfect for a
portfolio.

💸 Refund Lifecycle Tracker

A robust, enterprise-grade refund management system built with Node.js, Express,
and MySQL. This project demonstrates a strict state-machine architecture,
concurrency control via optimistic locking, and automated background processing.

Project Preview

🚀 Key Features

  - Custom State Machine: Prevents illegal business transitions (e.g., you
    cannot approve a refund that hasn't been reviewed).
  - Optimistic Locking: Uses version-based concurrency control to prevent data
    corruption during simultaneous updates.
  - Automated SLA Monitoring: A background worker identifies refunds stuck in a
    state for too long and auto-escalates them.
  - Comprehensive Audit Trail: Every state change is logged with a timestamp,
    the user responsible, and an optional note.
  - Vanilla JS Dashboard: A high-performance, framework-free frontend for
    managing refunds and simulating race conditions.

🛠 Tech Stack

  - Backend: Node.js, Express.js
  - Database: MySQL (mysql2/promise)
  - Frontend: HTML5, Tailwind CSS, Vanilla JavaScript
  - Concurrency: Version-based Optimistic Locking
  - Automation: Periodic background jobs via setInterval

📂 Project Structure

├── config/             # Database connection pool
├── jobs/               # Background tasks (SLA Checker)
├── models/             # SQL Schema definitions
├── public/             # Frontend assets (HTML, CSS, JS)
├── routes/             # API endpoint definitions
├── services/           # Core business logic & DB operations
├── utils/              # Custom errors & State Machine rules
├── .env                # Environment variables
└── server.js           # App entry point & middleware

⚙️ Installation & Setup

1.  Clone the repository:

    git clone [https://github.com/YOUR_USERNAME/refund-lifecycle-tracker.git](https://github.com/aarohibhatnagar13/refund-lifecycle-tracker)
    cd refund-lifecycle-tracker

2.  Install dependencies:

    npm install

3.  Database Setup:

      - Create a MySQL database named refund_tracker.
      - Import the schema from models/schema.sql.

4.  Environment Variables:

      - Create a .env file in the root directory.
      - Add your credentials:
        PORT=3000
        DB_HOST=localhost
        DB_USER=root
        DB_PASSWORD=
        DB_NAME=refund_tracker

5.  Run the application:

    node server.js

    Visit http://localhost:3000 in your browser.

🧠 Architecture Highlights

State Machine Logic

The system follows a strict lifecycle. Transitions are validated in
utils/stateMachine.js:

  - RAISED → UNDER_REVIEW
  - UNDER_REVIEW → APPROVED or DENIED
  - APPROVED → PROCESSING → CREDITED

Optimistic Locking

To handle high-traffic environments, the system uses a version column. When
updating a refund, the SQL query checks:

UPDATE refunds SET current_state = ?, version = version + 1 
WHERE id = ? AND version = ?;

If two managers try to approve the same refund at once, only the first one
succeeds. The second receives a 409 Conflict error.

Background SLA Job

The jobs/slaChecker.js runs every 5 minutes. It calculates the time elapsed
since the last update:

  - UNDER_REVIEW: 24h limit
  - APPROVED: 12h limit Breached refunds are automatically moved to the
    ESCALATED state by the "SYSTEM" user.

📡 API Endpoints

| Method  | Endpoint                         | Description                                  |
| :------ | :------------------------------- | :------------------------------------------- |
| `GET`   | `/api/refunds`                   | List all refunds (supports `?state=` filter) |
| `POST`  | `/api/refunds`                   | Raise a new refund                           |
| `GET`   | `/api/refunds/:id`               | Get refund details + full history            |
| `PATCH` | `/api/refunds/:id/state`         | Transition a refund to a new state           |
| `POST`  | `/api/refunds/dev/run-sla-check` | Manually trigger the SLA watchdog            |

🧪 Testing Concurrency

Use the "Simulate Race Condition" button on the Refund Detail page. It fires two
simultaneous PATCH requests. Because of the versioning logic, you will see one
succeed (200) and one fail (409), demonstrating the system's data integrity.
