# AggieAI

**Website:** [https://www.aggieai.us](https://www.aggieai.us)

AggieAI is a web application for Texas A&M University students to make informed academic decisions. It combines historical grade distribution data, RateMyProfessor reviews, and an AI-powered advising agent into a single platform.

## Features

### AI Course Advisor (Home Page)

- **Multi-course selection** — select up to 5 courses simultaneously with an inline tag-based picker; optionally filter by specific professors per course
- **Agentic RAG pipeline** — pre-fetches GPA summaries, instructor stats, and RateMyProfessor snapshots for selected courses, then passes them as context to an AI agent powered by GPT-4o-mini
- **Deep-dive tools** — the agent can call specialized tools for term-by-term GPA breakdowns, section-level grade rows, department-wide course rankings, professor course lookups, and live RMP scraping
- **Live web search** — every query triggers an OpenAI web search for up-to-date Texas A&M context (syllabi, Reddit threads, catalog pages) with source citations
- **Streaming responses** — real-time SSE streaming with tool call progress chips (spinner while running, checkmark on completion)
- **Course and professor link pills** — clickable pills after each AI response link directly to the Anex detail pages

### Anex (Course & Professor Explorer)

- **Unified search** — search for courses or professors from a single search bar with type-aware results (book icon for courses, person icon for professors)
- **Course detail view**
  - Interactive GPA trend charts (line, bar, and heatmap views) with per-instructor filtering
  - Full grade distribution data table with sortable columns
  - Instructor names link directly to their professor overview page
  - Season/term filtering and instructor selection
- **Professor detail view**
  - Overview card with name, department, and course count
  - RateMyProfessor metrics (overall rating, difficulty, would-take-again, total ratings, top tags) loaded asynchronously with skeleton placeholders
  - Per-course stats grid showing average GPA, sections taught, terms, latest term, student count, and A/B/C/D/F grade distribution bars
  - Click any course card to jump to its full course detail view
- **Cross-linking** — navigate between course and professor views seamlessly via URL params (`?course=` and `?professor=`)

### Design

- Custom color palette: warm beige background (`#f7f5f3`), maroon accents (`#800020`), dark chat bubbles for user messages, light for AI responses
- Typography: Cormorant Garamond for headings, Nunito for navigation and body text
- Framer Motion animations throughout
- Fully responsive mobile layout

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| AI SDK | Vercel AI SDK + OpenAI GPT-4o-mini |
| Database | PostgreSQL (Neon Serverless + pg pool) |
| Web Scraping | Axios + Cheerio (RateMyProfessor) |
| Charts | Recharts |
| Animations | Framer Motion |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- A PostgreSQL database with TAMU grade distribution tables (one table per course, e.g. `csce121`, `math151`) and a `professor` table
- An OpenAI API key

### Environment Variables

Create a `.env.local` file in `garnett_frontend/`:

```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
```

### Install and Run

```bash
cd garnett_frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
garnett_frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx              # AI chat home page
│   │   ├── anex/page.tsx         # Course & professor explorer
│   │   ├── globals.css           # Theme variables and global styles
│   │   └── api/
│   │       ├── answer_with_rag/  # Main AI agent endpoint (SSE streaming)
│   │       ├── fetch_courses/    # Course list endpoint
│   │       ├── get_gpa_by_term/  # GPA trend data
│   │       ├── get_course_data/  # Full grade distribution
│   │       ├── get_professor_courses/  # Professor course stats (uses course_tables index)
│   │       ├── get_rmp_profile/  # Server-side RMP scraper proxy
│   │       └── search_professors/  # Professor search
│   ├── components/
│   │   ├── Navbar.tsx
│   │   ├── CourseSelector.tsx    # Multi-course + professor picker
│   │   ├── GpaLineGraph.tsx      # Line/bar/heatmap chart tabs
│   │   ├── CourseDataTable.tsx   # Grade distribution table
│   │   ├── CourseLinkCard.tsx    # Course + professor link pills
│   │   └── MarkdownMessage.tsx   # AI response markdown renderer
│   └── lib/rag/
│       ├── run-agent.ts          # Agent orchestration (streamText)
│       ├── rag-tools.ts          # Tool definitions (GPA, RMP, web search)
│       ├── prompts.ts            # System prompt and message building
│       ├── prefetch.ts           # Pre-fetch pipeline for selected courses
│       ├── queries.ts            # Database query functions
│       ├── rmp-scrape.ts         # RateMyProfessor scraper
│       └── db-pool.ts            # PostgreSQL connection pool
```
