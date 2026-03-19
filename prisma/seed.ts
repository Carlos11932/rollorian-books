import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const BookStatus = {
  WISHLIST: "WISHLIST",
  TO_READ: "TO_READ",
  READING: "READING",
  READ: "READ",
} as const;

type BookStatusValue = (typeof BookStatus)[keyof typeof BookStatus];

async function main() {
  await prisma.book.deleteMany();

  await prisma.book.createMany({
    data: [
      {
        title: "Dune",
        authors: ["Frank Herbert"],
        description:
          "Set on the desert planet Arrakis, Dune is the story of Paul Atreides.",
        coverUrl:
          "https://books.google.com/books/content?id=B1hSG45JCX4C&printsec=frontcover&img=1&zoom=1",
        publisher: "Ace Books",
        publishedDate: "1965",
        pageCount: 688,
        isbn13: "9780441172719",
        status: BookStatus.READ as BookStatusValue,
        rating: 5,
        notes: "A masterpiece of science fiction.",
        genres: ["Science Fiction", "Fantasy"],
      },
      {
        title: "The Hobbit",
        authors: ["J.R.R. Tolkien"],
        description: "Bilbo Baggins is a hobbit who enjoys a comfortable life.",
        coverUrl:
          "https://books.google.com/books/content?id=pD6arNyKyi8C&printsec=frontcover&img=1&zoom=1",
        publisher: "Houghton Mifflin",
        publishedDate: "1937",
        pageCount: 310,
        isbn13: "9780547928227",
        status: BookStatus.READING as BookStatusValue,
        rating: 4,
        genres: ["Fantasy", "Adventure"],
      },
      {
        title: "Clean Code",
        authors: ["Robert C. Martin"],
        description: "A handbook of agile software craftsmanship.",
        coverUrl:
          "https://books.google.com/books/content?id=_i6bDeoCQzsC&printsec=frontcover&img=1&zoom=1",
        publisher: "Prentice Hall",
        publishedDate: "2008",
        pageCount: 464,
        isbn13: "9780132350884",
        status: BookStatus.TO_READ as BookStatusValue,
        genres: ["Programming", "Software Engineering"],
      },
      {
        title: "Sapiens",
        authors: ["Yuval Noah Harari"],
        description: "A brief history of humankind.",
        coverUrl:
          "https://books.google.com/books/content?id=1EiJAwAAQBAJ&printsec=frontcover&img=1&zoom=1",
        publisher: "Harper",
        publishedDate: "2015",
        pageCount: 464,
        isbn13: "9780062316097",
        status: BookStatus.WISHLIST as BookStatusValue,
        genres: ["History", "Non-Fiction"],
      },
      {
        title: "The Pragmatic Programmer",
        authors: ["David Thomas", "Andrew Hunt"],
        description: "Your journey to mastery.",
        coverUrl:
          "https://books.google.com/books/content?id=LhOlDwAAQBAJ&printsec=frontcover&img=1&zoom=1",
        publisher: "Addison-Wesley",
        publishedDate: "2019",
        pageCount: 352,
        isbn13: "9780135957059",
        status: BookStatus.READ as BookStatusValue,
        rating: 5,
        notes: "Essential reading for every developer.",
        genres: ["Programming", "Career"],
      },
    ],
  });

  console.log("Seed complete: 5 books created");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
