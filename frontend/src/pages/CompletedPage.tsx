import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ExternalLink, Star, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ProductItem {
  asin: string;
  product_name: string;
}

interface OutputReview {
  asin: string;
  product_name: string;
  star_rating: number;
  review_title: string;
  review_text: string;
}

export default function CompletedPage() {
  const [productList] = useLocalStorage<ProductItem[]>('productList', []);
  const [completedProducts] = useLocalStorage<string[]>('completedProducts', []);
  const [outputReviews] = useLocalStorage<OutputReview[]>('outputReviews', []);
  const [, setCurrentIndex] = useLocalStorage<number>('currentProductIndex', 0);
  const navigate = useNavigate();

  const completedItems = completedProducts
    .map((asin) => {
      const product = productList.find((p) => p.asin === asin);
      const review = outputReviews.find((r) => r.asin === asin);
      if (!product) return null;
      return { asin, product, review };
    })
    .filter(Boolean) as { asin: string; product: ProductItem; review?: OutputReview }[];

  const handleGoToProduct = (asin: string) => {
    const idx = productList.findIndex((p) => p.asin === asin);
    if (idx !== -1) {
      setCurrentIndex(idx);
      navigate('/review');
    }
  };

  if (completedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Completed Reviews</h2>
        <p className="text-muted-foreground mb-4">
          Mark reviews as complete on the Review page to see them here.
        </p>
        <Button onClick={() => navigate('/review')}>Go to Review</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Completed Reviews</h1>
        <p className="text-muted-foreground mt-1">
          {completedItems.length} of {productList.length} products completed
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            All Completed Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left font-medium px-4 py-2.5">#</th>
                  <th className="text-left font-medium px-4 py-2.5">Product</th>
                  <th className="text-left font-medium px-4 py-2.5 hidden sm:table-cell">ASIN</th>
                  <th className="text-left font-medium px-4 py-2.5">Rating</th>
                  <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">Title</th>
                  <th className="text-right font-medium px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {completedItems.map((item, i) => (
                  <tr key={item.asin} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="line-clamp-2 max-w-[200px] sm:max-w-[300px]">
                        {item.product.product_name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {item.asin}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      {item.review ? (
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {item.review.star_rating}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell">
                      <span className="line-clamp-1 max-w-[250px] text-muted-foreground">
                        {item.review?.review_title || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleGoToProduct(item.asin)}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(`https://www.amazon.com/dp/${item.asin}`, '_blank')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
