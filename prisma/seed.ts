import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { assertSafeSeedEnvironment } from "../src/lib/database-safety";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

assertSafeSeedEnvironment(connectionString, process.env);

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const BookStatus = {
  WISHLIST: "WISHLIST",
  TO_READ: "TO_READ",
  READING: "READING",
  READ: "READ",
} as const;

type BookStatusValue = (typeof BookStatus)[keyof typeof BookStatus];

function writeInfo(message: string) {
  process.stdout.write(`${message}\n`);
}

async function main() {
  const seedUser = await prisma.user.upsert({
    where: { email: "carlos@rollorian.dev" },
    create: { name: "Carlos", email: "carlos@rollorian.dev", image: null },
    update: {},
  });

  // Delete books first (FK → user), then other user data is handled by cascade
  await prisma.book.deleteMany();

  const seededBooks: Array<{
    book: {
      title: string;
      authors: string[];
      description: string;
      coverUrl: string;
      publisher: string;
      publishedDate: string;
      pageCount: number;
      isbn13: string;
      genres: string[];
    };
    libraryEntry: {
      status: BookStatusValue;
      rating?: number;
      notes?: string;
    };
  }> = [
    {
      book: {
        title: "Dune",
        authors: ["Frank Herbert"],
        description: "Set on the desert planet Arrakis, Dune is the story of Paul Atreides.",
        coverUrl: "https://books.google.com/books/content?id=B1hSG45JCX4C&printsec=frontcover&img=1&zoom=1",
        publisher: "Ace Books",
        publishedDate: "1965",
        pageCount: 688,
        isbn13: "9780441172719",
        genres: ["Science Fiction", "Fantasy"],
      },
      libraryEntry: {
        status: BookStatus.READ,
        rating: 5,
        notes: "A masterpiece of science fiction.",
      },
    },
    {
      book: {
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        description: "Bilbo Baggins is a hobbit who enjoys a comfortable life.",
        coverUrl: "https://books.google.com/books/content?id=pD6arNyKyi8C&printsec=frontcover&img=1&zoom=1",
        publisher: "Houghton Mifflin",
        publishedDate: "1937",
        pageCount: 310,
        isbn13: "9780547928227",
        genres: ["Fantasy", "Adventure"],
      },
      libraryEntry: {
        status: BookStatus.READING,
        rating: 4,
      },
    },
    {
      book: {
        title: "Clean Code",
        authors: ["Robert C. Martin"],
        description: "A handbook of agile software craftsmanship.",
        coverUrl: "https://books.google.com/books/content?id=_i6bDeoCQzsC&printsec=frontcover&img=1&zoom=1",
        publisher: "Prentice Hall",
        publishedDate: "2008",
        pageCount: 464,
        isbn13: "9780132350884",
        genres: ["Programming", "Software Engineering"],
      },
      libraryEntry: {
        status: BookStatus.TO_READ,
      },
    },
    {
      book: {
        title: "Sapiens",
        authors: ["Yuval Noah Harari"],
        description: "A brief history of humankind.",
        coverUrl: "https://books.google.com/books/content?id=1EiJAwAAQBAJ&printsec=frontcover&img=1&zoom=1",
        publisher: "Harper",
        publishedDate: "2015",
        pageCount: 464,
        isbn13: "9780062316097",
        genres: ["History", "Non-Fiction"],
      },
      libraryEntry: {
        status: BookStatus.WISHLIST,
      },
    },
    {
      book: {
        title: "The Pragmatic Programmer",
        authors: ["David Thomas", "Andrew Hunt"],
        description: "Your journey to mastery.",
        coverUrl: "https://books.google.com/books/content?id=LhOlDwAAQBAJ&printsec=frontcover&img=1&zoom=1",
        publisher: "Addison-Wesley",
        publishedDate: "2019",
        pageCount: 352,
        isbn13: "9780135957059",
        genres: ["Programming", "Career"],
      },
      libraryEntry: {
        status: BookStatus.READ,
        rating: 5,
        notes: "Essential reading for every developer.",
      },
    },
  ];

  for (const { book: bookInput, libraryEntry } of seededBooks) {
    const book = await prisma.book.create({ data: bookInput });

    await prisma.userBook.create({
      data: {
        userId: seedUser.id,
        bookId: book.id,
        status: libraryEntry.status,
        ...(libraryEntry.status === BookStatus.READ ? { finishedAt: new Date() } : {}),
        ...(libraryEntry.rating !== undefined ? { rating: libraryEntry.rating } : {}),
        ...(libraryEntry.notes !== undefined ? { notes: libraryEntry.notes } : {}),
      },
    });
  }

  writeInfo(`Seed complete: 5 books created for user ${seedUser.email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
