          <TabsContent value="posts" className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <EntityFormCard
              title={postForm.id ? "Редактировать пост" : "Новый пост"}
              description="Заполняйте только основные поля. Изменения сразу попадут в club feed после сохранения."
              footer={
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handlePostSubmit}
                    disabled={createPost.isPending || updatePost.isPending}
                  >
                    {postForm.id ? "Сохранить пост" : "Создать пост"}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setPostForm(defaultPostForm());
                    setPostErrors({});
                  }}>Очистить</Button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Категория" error={postErrors.category}><Input aria-invalid={Boolean(postErrors.category)} value={postForm.category} onChange={(e) => {
                  const value = e.target.value;
                  setPostForm({ ...postForm, category: value });
                  if (postErrors.category) setPostErrors((current: typeof postErrors) => ({ ...current, category: undefined }));
                }} /></Field>
                <Field label="Автор" error={postErrors.author}><Input aria-invalid={Boolean(postErrors.author)} value={postForm.author} onChange={(e) => {
                  const value = e.target.value;
                  setPostForm({ ...postForm, author: value });
                  if (postErrors.author) setPostErrors((current: typeof postErrors) => ({ ...current, author: undefined }));
                }} /></Field>
                <Field label="Аватар"><Input value={postForm.avatar} onChange={(e) => setPostForm({ ...postForm, avatar: e.target.value.slice(0, 8) })} /></Field>
                <Field label="Роль автора" error={postErrors.role}><Input aria-invalid={Boolean(postErrors.role)} value={postForm.role} onChange={(e) => {
                  const value = e.target.value;
                  setPostForm({ ...postForm, role: value });
                  if (postErrors.role) setPostErrors((current: typeof postErrors) => ({ ...current, role: undefined }));
                }} /></Field>
                <Field label="Время" error={postErrors.timeLabel}><Input aria-invalid={Boolean(postErrors.timeLabel)} value={postForm.timeLabel} onChange={(e) => {
                  const value = e.target.value;
                  setPostForm({ ...postForm, timeLabel: value });
                  if (postErrors.timeLabel) setPostErrors((current: typeof postErrors) => ({ ...current, timeLabel: undefined }));
                }} /></Field>
                <Field label="Порядок"><Input type="number" value={postForm.sortOrder} onChange={(e) => setPostForm({ ...postForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
                <Field label="Лайки"><Input type="number" value={postForm.likes} onChange={(e) => setPostForm({ ...postForm, likes: Number(e.target.value) || 0 })} /></Field>
                <Field label="Комментарии"><Input type="number" value={postForm.comments} onChange={(e) => setPostForm({ ...postForm, comments: Number(e.target.value) || 0 })} /></Field>
              </div>
              <Field label="Заголовок" error={postErrors.title}><Input aria-invalid={Boolean(postErrors.title)} value={postForm.title} onChange={(e) => {
                const value = e.target.value;
                setPostForm({ ...postForm, title: value });
                if (postErrors.title) setPostErrors((current: typeof postErrors) => ({ ...current, title: undefined }));
              }} /></Field>
              <Field label="Изображение (URL)"><Input value={postForm.imageUrl} onChange={(e) => setPostForm({ ...postForm, imageUrl: e.target.value })} placeholder="https://..." /></Field>
              <Field label="Теги CSV"><Input value={postForm.tagsCsv} onChange={(e) => setPostForm({ ...postForm, tagsCsv: e.target.value })} placeholder="утро,марта,клуб" /></Field>
              <Field label="Текст поста" error={postErrors.text}><Textarea aria-invalid={Boolean(postErrors.text)} value={postForm.text} onChange={(e) => {
                const value = e.target.value;
                setPostForm({ ...postForm, text: value });
                if (postErrors.text) setPostErrors((current: typeof postErrors) => ({ ...current, text: undefined }));
              }} className="min-h-32" /></Field>
              <div className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3">
                <div>
                  <p className="font-medium text-stone-950">Закрепить пост</p>
                  <p className="text-sm text-stone-500">Закреплённые посты поднимаются вверх в ленте.</p>
                </div>
                <Switch checked={postForm.pinned} onCheckedChange={(checked) => setPostForm({ ...postForm, pinned: checked })} />
              </div>
            </EntityFormCard>

            <EntityListCard
              title="Текущие посты"
              description="Быстрое редактирование, удаление, поиск и фильтрация материалов клуба."
              sortIndicator={{
                fieldLabel: postFilters.sortBy === "timeLabel" ? "времени" : postFilters.sortBy === "title" ? "заголовку" : "порядку",
                directionLabel: postFilters.sortDirection === "asc" ? "↑" : "↓",
              }}
              toolbar={
                <FilterToolbar
                  searchPlaceholder="Искать по заголовку, тексту, автору или тегам"
                  selectionCount={selectedPosts.length}
                  bulkActions={[
                    {
                      label: allVisiblePostsSelected ? "Снять выбор со всех" : "Выбрать все видимые",
                      icon: allVisiblePostsSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />,
                      variant: "outline",
                      disabled: filteredPosts.length === 0,
                      onClick: () => toggleSelectAllVisible("posts", filteredPosts.map((post) => post.id)),
                    },
                    {
                      label: "Закрепить выбранные",
                      icon: <Pin className="h-4 w-4" />,
                      variant: "outline",
                      disabled: selectedPosts.length === 0 || updatePost.isPending,
                      onClick: () => {
                        void (async () => {
                          for (const post of selectedPosts) {
                            await updatePost.mutateAsync({
                              id: post.id,
                              category: post.category,
                              author: post.author,
                              avatar: post.avatar,
                              role: post.role,
                              timeLabel: post.timeLabel,
                              title: post.title,
                              text: post.text,
                              imageUrl: post.imageUrl,
                              likes: post.likes,
                              comments: post.comments,
                              tagsCsv: post.tagsCsv,
                              pinned: true,
                              sortOrder: post.sortOrder,
                            });
                          }
                          clearSelection("posts");
                          const toastCopy = getBulkActionToastCopy("post", "pin", selectedPosts.length);
                          toast.success(toastCopy.title, {
                            description: toastCopy.description,
                          });

                        })();
                      },
                    },
                    {
                      label: "Открепить выбранные",
                      icon: <Pin className="h-4 w-4" />,
                      variant: "outline",
                      disabled: selectedPosts.length === 0 || updatePost.isPending,
                      onClick: () => {
                        void (async () => {
                          for (const post of selectedPosts) {
                            await updatePost.mutateAsync({
                              id: post.id,
                              category: post.category,
                              author: post.author,
                              avatar: post.avatar,
                              role: post.role,
                              timeLabel: post.timeLabel,
                              title: post.title,
                              text: post.text,
                              imageUrl: post.imageUrl,
                              likes: post.likes,
                              comments: post.comments,
                              tagsCsv: post.tagsCsv,
                              pinned: false,
                              sortOrder: post.sortOrder,
                            });
                          }
                          clearSelection("posts");
                          const toastCopy = getBulkActionToastCopy("post", "unpin", selectedPosts.length);
                          toast.success(toastCopy.title, {
                            description: toastCopy.description,
                          });

                        })();
                      },
                    },
                    {
                      label: "Удалить выбранные",
                      icon: <Trash2 className="h-4 w-4" />,
                      variant: "outline",
                      destructive: true,
                      disabled: selectedPosts.length === 0 || isDeleting,
                      onClick: () => setPendingDelete({
                        entity: "bulk-post",
                        ids: selectedPosts.map((post) => post.id),
                        title: `Выбрано постов: ${selectedPosts.length}`,
                        description: `${selectedPosts.length} постов`,
                        summaryItems: buildBulkDeleteSummaryItems(selectedPosts),
                        totalCount: selectedPosts.length,
                      }),
                    },
                  ]}
                  onClearSelection={() => clearSelection("posts")}
                  presetPanel={
                    <PresetToolbar
                      presetName={presetName.posts}
                      onPresetNameChange={(value) => setPresetName((current) => ({ ...current, posts: value }))}
                      onSave={() => void handleSavePreset("posts")}
                      saveDisabled={createPreset.isPending}
                      presets={presetsByTab.posts}
                      onApplyPreset={applyPreset}
                      onDeletePreset={(presetId) => void deletePreset.mutateAsync({ id: presetId })}
                      deletePending={deletePreset.isPending}
                    />
                  }
                  searchValue={postFilters.query}
                  resultCount={filteredPosts.length}
                  resultLabel="постов"
                  resetLabel="Сбросить фильтры постов"
                  activeFilterChips={[
                    postFilters.query
                      ? { label: `Поиск: ${postFilters.query}`, onRemove: () => setPostFilters((current) => ({ ...current, query: "" })) }
                      : null,
                    postFilters.category !== "all"
                      ? { label: `Категория: ${postFilters.category}`, onRemove: () => setPostFilters((current) => ({ ...current, category: "all" })) }
                      : null,
                    postFilters.pinned === "pinned"
                      ? { label: "Тип: только pinned", onRemove: () => setPostFilters((current) => ({ ...current, pinned: "all" })) }
                      : postFilters.pinned === "regular"
                        ? { label: "Тип: только обычные", onRemove: () => setPostFilters((current) => ({ ...current, pinned: "all" })) }
                        : null,
                    postFilters.sortBy !== "sortOrder"
                      ? { label: `Сортировка: ${postFilters.sortBy === "timeLabel" ? "время" : "заголовок"}`, onRemove: () => setPostFilters((current) => ({ ...current, sortBy: "sortOrder" })) }
                      : null,
                    postFilters.sortDirection !== "asc"
                      ? { label: "Порядок: по убыванию", onRemove: () => setPostFilters((current) => ({ ...current, sortDirection: "asc" })) }
                      : null,
                  ].filter(Boolean) as FilterChip[]}
                  onSearchChange={(value) => setPostFilters((current) => ({ ...current, query: value }))}
                  onReset={() => setPostFilters(defaultPostFilters())}
                  hasActiveFilters={postFilters.query !== "" || postFilters.category !== "all" || postFilters.pinned !== "all" || postFilters.sortBy !== "sortOrder" || postFilters.sortDirection !== "asc"}
                >
                  <SelectFilter
                    label="Категория"
                    value={postFilters.category}
                    onChange={(value) => setPostFilters((current) => ({ ...current, category: value }))}
                    options={[{ label: "Все категории", value: "all" }, ...postCategories.map((value) => ({ label: value, value }))]}
                  />
                  <SelectFilter
                    label="Тип"
                    value={postFilters.pinned}
                    onChange={(value) => setPostFilters((current) => ({ ...current, pinned: value as PostFilterState["pinned"] }))}
                    options={[
                      { label: "Все посты", value: "all" },
                      { label: "Только pinned", value: "pinned" },
                      { label: "Только обычные", value: "regular" },
                    ]}
                  />
                  <SelectFilter
                    label="Сортировать по"
                    value={postFilters.sortBy}
                    onChange={(value) => setPostFilters((current) => ({ ...current, sortBy: value as PostSortField }))}
                    options={[
                      { label: "Порядок", value: "sortOrder" },
                      { label: "Время", value: "timeLabel" },
                      { label: "Заголовок", value: "title" },
                    ]}
                  />
                  <SelectFilter
                    label="Направление"
                    value={postFilters.sortDirection}
                    onChange={(value) => setPostFilters((current) => ({ ...current, sortDirection: value as SortDirection }))}
                    options={[
                      { label: "По возрастанию", value: "asc" },
                      { label: "По убыванию", value: "desc" },
                    ]}
                  />
                </FilterToolbar>
              }
              items={paginatedPosts}
              pagination={buildPaginationMeta(filteredPosts.length, pagination.posts.page, pagination.posts.pageSize, totalPages.posts)}
              onPageChange={(page) => setTabPage("posts", page)}
              onPageSizeChange={(pageSize) => setTabPageSize("posts", pageSize)}
              emptyText="По текущим фильтрам посты не найдены."
              renderItem={(post: any) => (
                <ListRow
                  selected={selectedIds.posts.includes(post.id)}
                  onToggleSelected={() => toggleSelection("posts", post.id)}
                  title={post.title}
                  subtitle={`${post.author} · ${post.timeLabel}`}
                  meta={`Категория: ${post.category} · Порядок: ${post.sortOrder}`}
                  badge={post.pinned ? "Pinned" : undefined}
                  inlineActions={[
                    {
                      label: "Порядок",
                      value: post.sortOrder,
                      icon: <ArrowDown className="h-3.5 w-3.5" />,
                      disabled: updatePost.isPending,
                      onClick: async () => {
                        const nextSortOrder = post.sortOrder + 1;
                        await updatePost.mutateAsync({
                          id: post.id,
                          category: post.category,
                          author: post.author,
                          avatar: post.avatar,
                          role: post.role,
                          timeLabel: post.timeLabel,
                          title: post.title,
                          text: post.text,
                          imageUrl: post.imageUrl,
                          likes: post.likes,
                          comments: post.comments,
                          tagsCsv: post.tagsCsv,
                          pinned: post.pinned,
                          sortOrder: nextSortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("post", { title: post.title, sortOrder: nextSortOrder, pinned: post.pinned });
                        toast.success(toastCopy.sortOrder.title, {
                          description: toastCopy.sortOrder.description,
                        });
                      },
                    },
                    {
                      label: post.pinned ? "Pinned" : "Обычный",
                      icon: <Pin className="h-3.5 w-3.5" />,
                      disabled: updatePost.isPending,
                      onClick: async () => {
                        const nextPinned = !post.pinned;
                        await updatePost.mutateAsync({
                          id: post.id,
                          category: post.category,
                          author: post.author,
                          avatar: post.avatar,
                          role: post.role,
                          timeLabel: post.timeLabel,
                          title: post.title,
                          text: post.text,
                          imageUrl: post.imageUrl,
                          likes: post.likes,
                          comments: post.comments,
                          tagsCsv: post.tagsCsv,
                          pinned: nextPinned,
                          sortOrder: post.sortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("post", { title: post.title, sortOrder: post.sortOrder, pinned: nextPinned });
                        toast.success(toastCopy.status.title, {
                          description: toastCopy.status.description,
                        });
                      },
                    },
                  ]}
                  onEdit={() => setPostForm({
                    id: post.id,
                    category: post.category,
                    author: post.author,
                    avatar: post.avatar,
                    role: post.role,
                    timeLabel: post.timeLabel,
                    title: post.title,
                    text: post.text,
                    imageUrl: post.imageUrl,
                    likes: post.likes,
                    comments: post.comments,
                    tagsCsv: post.tagsCsv,
                    pinned: Boolean(post.pinned),
                    sortOrder: post.sortOrder,
                  })}
                  onDelete={() => setPendingDelete({
                    entity: "post",
                    id: post.id,
                    title: post.title,
                    description: `пост «${post.title}»`,
                  })}
                  deleting={isDeleting && pendingDelete?.entity === "post" && pendingDelete.id === post.id}
                />
              )}
            />
          </TabsContent>
