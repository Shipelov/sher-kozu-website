import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import PageBreadcrumbs from "@/components/PageBreadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Eye, EyeOff, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Comment = {
  id: number;
  postId: number;
  userOpenId: string;
  userName: string;
  text: string;
  hidden: boolean;
  createdAt: string;
};

export default function AdminClubComments() {
  const { user, loading } = useAuth();
  const searchString = useSearch();
  const postId = Number(new URLSearchParams(searchString).get("postId")) || 0;

  const commentsQuery = trpc.club.adminListComments.useQuery(
    { postId },
    { enabled: postId > 0 && Boolean((user as any)?.role === "admin") }
  );

  const hideComment = trpc.club.adminHideComment.useMutation({
    onSuccess: () => {
      commentsQuery.refetch();
      toast.success("Комментарий скрыт");
    },
    onError: (err) => toast.error(err.message),
  });

  const unhideComment = trpc.club.adminUnhideComment.useMutation({
    onSuccess: () => {
      commentsQuery.refetch();
      toast.success("Комментарий восстановлен");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteComment = trpc.club.adminDeleteComment.useMutation({
    onSuccess: () => {
      commentsQuery.refetch();
      toast.success("Комментарий удалён");
    },
    onError: (err) => toast.error(err.message),
  });

  const comments = (commentsQuery.data ?? []) as Comment[];
  const visibleCount = comments.filter((c) => !c.hidden).length;
  const hiddenCount = comments.filter((c) => c.hidden).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container py-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка…
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container space-y-6 py-6 md:py-8">
        <PageBreadcrumbs
          items={[
            { label: "Главная", href: "/" },
            { label: "Admin", href: "/admin" },
            { label: "Клуб", href: "/admin/club" },
            { label: `Комментарии к посту #${postId}` },
          ]}
        />

        <div className="flex items-center gap-3">
          <Link href="/admin/club?tab=posts">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Назад к постам
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">
            Комментарии к посту #{postId}
          </h1>
        </div>

        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Всего: {comments.length}</span>
          <span>Видимых: {visibleCount}</span>
          <span>Скрытых: {hiddenCount}</span>
        </div>

        {commentsQuery.isLoading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка комментариев…
          </div>
        ) : comments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-muted-foreground">
                К этому посту пока нет комментариев.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <Card
                key={comment.id}
                className={comment.hidden ? "opacity-60" : ""}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {comment.userName.slice(0, 2)}
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        {comment.userName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleString("ru-RU")}
                      </span>
                      {comment.hidden && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                          Скрыт
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {comment.text}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      User ID: {comment.userOpenId}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {comment.hidden ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          unhideComment.mutate({ commentId: comment.id })
                        }
                        disabled={unhideComment.isPending}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Показать
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          hideComment.mutate({ commentId: comment.id })
                        }
                        disabled={hideComment.isPending}
                      >
                        <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                        Скрыть
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Удалить
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Удалить комментарий?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Комментарий от {comment.userName} будет удалён
                            навсегда. Это действие нельзя отменить.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              deleteComment.mutate({
                                commentId: comment.id,
                              })
                            }
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
