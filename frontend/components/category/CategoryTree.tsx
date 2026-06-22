import Link from "next/link";
import { Category } from "@/types/marketplace";

function CategoryNode({ category }: { category: Category }) {
  const children = Array.isArray(category.children) ? category.children : [];

  if (children.length === 0) {
    return (
      <li>
        <Link href={`/categories/${category.slug}`} className="text-sm text-textSecondary hover:text-textPrimary">
          {category.name}
        </Link>
      </li>
    );
  }

  return (
    <li className="space-y-2">
      <Link href={`/categories/${category.slug}`} className="text-sm text-textSecondary hover:text-textPrimary">
        {category.name}
      </Link>
      <ul className="ml-4 space-y-2 border-l border-border/70 pl-3">
        {children.map((child) => (
          <CategoryNode key={child.id} category={child} />
        ))}
      </ul>
    </li>
  );
}

export function CategoryTree({ categories }: { categories: Category[] }) {
  const safeCategories = Array.isArray(categories) ? categories : [];

  return (
    <ul className="space-y-2">
      {safeCategories.map((category) => (
        <CategoryNode key={category.id} category={category} />
      ))}
    </ul>
  );
}
