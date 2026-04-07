export interface LoanView {
  id: string;
  bookId: string;
  bookTitle: string;
  bookCoverUrl: string | null;
  bookAuthors: string[];
  lenderId: string;
  lenderName: string | null;
  lenderImage: string | null;
  borrowerId: string;
  borrowerName: string | null;
  borrowerImage: string | null;
  status: string;
  createdAt: string;
}

export const LOAN_SELECT = {
  id: true,
  bookId: true,
  status: true,
  createdAt: true,
  lenderId: true,
  borrowerId: true,
  book: {
    select: { title: true, coverUrl: true, authors: true },
  },
  lender: {
    select: { id: true, name: true, image: true },
  },
  borrower: {
    select: { id: true, name: true, image: true },
  },
} as const;

export function toLoanView(loan: {
  id: string;
  bookId: string;
  status: string;
  createdAt: Date;
  lenderId: string;
  borrowerId: string;
  book: { title: string; coverUrl: string | null; authors: string[] };
  lender: { id: string; name: string | null; image: string | null };
  borrower: { id: string; name: string | null; image: string | null };
}): LoanView {
  return {
    id: loan.id,
    bookId: loan.bookId,
    bookTitle: loan.book.title,
    bookCoverUrl: loan.book.coverUrl,
    bookAuthors: loan.book.authors,
    lenderId: loan.lenderId,
    lenderName: loan.lender.name,
    lenderImage: loan.lender.image,
    borrowerId: loan.borrowerId,
    borrowerName: loan.borrower.name,
    borrowerImage: loan.borrower.image,
    status: loan.status,
    createdAt: loan.createdAt.toISOString(),
  };
}
