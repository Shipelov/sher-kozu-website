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

          <TabsContent value="events" className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <EntityFormCard
              title={eventForm.id ? "Редактировать событие" : "Новое событие"}
              description="Используйте короткие формулировки, чтобы карточки легко читались в Club Feed."
              footer={
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleEventSubmit}
                    disabled={createEvent.isPending || updateEvent.isPending}
                  >
                    {eventForm.id ? "Сохранить событие" : "Создать событие"}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setEventForm(defaultEventForm());
                    setEventErrors({});
                  }}>Очистить</Button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Название" error={eventErrors.title}><Input aria-invalid={Boolean(eventErrors.title)} value={eventForm.title} onChange={(e) => {
                  const value = e.target.value;
                  setEventForm({ ...eventForm, title: value });
                  if (eventErrors.title) setEventErrors((current: typeof eventErrors) => ({ ...current, title: undefined }));
                }} /></Field>
                <Field label="Дата" error={eventErrors.dateLabel}><Input aria-invalid={Boolean(eventErrors.dateLabel)} value={eventForm.dateLabel} onChange={(e) => {
                  const value = e.target.value;
                  setEventForm({ ...eventForm, dateLabel: value });
                  if (eventErrors.dateLabel) setEventErrors((current: typeof eventErrors) => ({ ...current, dateLabel: undefined }));
                }} /></Field>
                <Field label="Статус" error={eventErrors.status}><Input aria-invalid={Boolean(eventErrors.status)} value={eventForm.status} onChange={(e) => {
                  const value = e.target.value;
                  setEventForm({ ...eventForm, status: value });
                  if (eventErrors.status) setEventErrors((current: typeof eventErrors) => ({ ...current, status: undefined }));
                }} /></Field>
                <Field label="Тон" error={eventErrors.tone}><Input aria-invalid={Boolean(eventErrors.tone)} value={eventForm.tone} onChange={(e) => {
                  const value = e.target.value;
                  setEventForm({ ...eventForm, tone: value });
                  if (eventErrors.tone) setEventErrors((current: typeof eventErrors) => ({ ...current, tone: undefined }));
                }} /></Field>
                <Field label="Порядок"><Input type="number" value={eventForm.sortOrder} onChange={(e) => setEventForm({ ...eventForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
              </div>
              <Field label="Описание" error={eventErrors.description}><Textarea aria-invalid={Boolean(eventErrors.description)} value={eventForm.description} onChange={(e) => {
                const value = e.target.value;
                setEventForm({ ...eventForm, description: value });
                if (eventErrors.description) setEventErrors((current: typeof eventErrors) => ({ ...current, description: undefined }));
              }} className="min-h-32" /></Field>
            </EntityFormCard>

            <EntityListCard
              title="События клуба"
              description="Редактируйте даты, статусы и тексты, а также быстро находите нужные записи."
              sortIndicator={{
                fieldLabel: eventFilters.sortBy === "dateLabel" ? "дате" : eventFilters.sortBy === "status" ? "статусу" : "порядку",
                directionLabel: eventFilters.sortDirection === "asc" ? "↑" : "↓",
              }}
              toolbar={
                <FilterToolbar
                  searchPlaceholder="Искать по названию, описанию или дате"
                  selectionCount={selectedEvents.length}
                  bulkActions={[
                    {
                      label: allVisibleEventsSelected ? "Снять выбор со всех" : "Выбрать все видимые",
                      icon: allVisibleEventsSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />,
                      variant: "outline",
                      disabled: filteredEvents.length === 0,
                      onClick: () => toggleSelectAllVisible("events", filteredEvents.map((event) => event.id)),
                    },
                    {
                      label: "Удалить выбранные",
                      icon: <Trash2 className="h-4 w-4" />,
                      variant: "outline",
                      destructive: true,
                      disabled: selectedEvents.length === 0 || isDeleting,
                      onClick: () => setPendingDelete({
                        entity: "bulk-event",
                        ids: selectedEvents.map((event) => event.id),
                        title: `Выбрано событий: ${selectedEvents.length}`,
                        description: `${selectedEvents.length} событий`,
                        summaryItems: buildBulkDeleteSummaryItems(selectedEvents),
                        totalCount: selectedEvents.length,
                      }),
                    },
                  ]}
                  onClearSelection={() => clearSelection("events")}
                  presetPanel={
                    <PresetToolbar
                      presetName={presetName.events}
                      onPresetNameChange={(value) => setPresetName((current) => ({ ...current, events: value }))}
                      onSave={() => void handleSavePreset("events")}
                      saveDisabled={createPreset.isPending}
                      presets={presetsByTab.events}
                      onApplyPreset={applyPreset}
                      onDeletePreset={(presetId) => void deletePreset.mutateAsync({ id: presetId })}
                      deletePending={deletePreset.isPending}
                    />
                  }
                  searchValue={eventFilters.query}
                  resultCount={filteredEvents.length}
                  resultLabel="событий"
                  resetLabel="Сбросить фильтры событий"
                  activeFilterChips={[
                    eventFilters.query
                      ? { label: `Поиск: ${eventFilters.query}`, onRemove: () => setEventFilters((current) => ({ ...current, query: "" })) }
                      : null,
                    eventFilters.status !== "all"
                      ? { label: `Статус: ${eventFilters.status}`, onRemove: () => setEventFilters((current) => ({ ...current, status: "all" })) }
                      : null,
                    eventFilters.tone !== "all"
                      ? { label: `Тон: ${eventFilters.tone}`, onRemove: () => setEventFilters((current) => ({ ...current, tone: "all" })) }
                      : null,
                    eventFilters.sortBy !== "sortOrder"
                      ? { label: `Сортировка: ${eventFilters.sortBy === "dateLabel" ? "дата" : "статус"}`, onRemove: () => setEventFilters((current) => ({ ...current, sortBy: "sortOrder" })) }
                      : null,
                    eventFilters.sortDirection !== "asc"
                      ? { label: "Порядок: по убыванию", onRemove: () => setEventFilters((current) => ({ ...current, sortDirection: "asc" })) }
                      : null,
                  ].filter(Boolean) as FilterChip[]}
                  onSearchChange={(value) => setEventFilters((current) => ({ ...current, query: value }))}
                  onReset={() => setEventFilters(defaultEventFilters())}
                  hasActiveFilters={eventFilters.query !== "" || eventFilters.status !== "all" || eventFilters.tone !== "all" || eventFilters.sortBy !== "sortOrder" || eventFilters.sortDirection !== "asc"}
                >
                  <SelectFilter
                    label="Статус"
                    value={eventFilters.status}
                    onChange={(value) => setEventFilters((current) => ({ ...current, status: value }))}
                    options={[{ label: "Все статусы", value: "all" }, ...eventStatuses.map((value) => ({ label: value, value }))]}
                  />
                  <SelectFilter
                    label="Тон"
                    value={eventFilters.tone}
                    onChange={(value) => setEventFilters((current) => ({ ...current, tone: value }))}
                    options={[{ label: "Все тона", value: "all" }, ...eventTones.map((value) => ({ label: value, value }))]}
                  />
                  <SelectFilter
                    label="Сортировать по"
                    value={eventFilters.sortBy}
                    onChange={(value) => setEventFilters((current) => ({ ...current, sortBy: value as EventSortField }))}
                    options={[
                      { label: "Порядок", value: "sortOrder" },
                      { label: "Дату", value: "dateLabel" },
                      { label: "Статус", value: "status" },
                    ]}
                  />
                  <SelectFilter
                    label="Направление"
                    value={eventFilters.sortDirection}
                    onChange={(value) => setEventFilters((current) => ({ ...current, sortDirection: value as SortDirection }))}
                    options={[
                      { label: "По возрастанию", value: "asc" },
                      { label: "По убыванию", value: "desc" },
                    ]}
                  />
                </FilterToolbar>
              }
              items={paginatedEvents}
              pagination={buildPaginationMeta(filteredEvents.length, pagination.events.page, pagination.events.pageSize, totalPages.events)}
              onPageChange={(page) => setTabPage("events", page)}
              onPageSizeChange={(pageSize) => setTabPageSize("events", pageSize)}
              emptyText="По текущим фильтрам события не найдены."
              renderItem={(event: any) => (
                <ListRow
                  selected={selectedIds.events.includes(event.id)}
                  onToggleSelected={() => toggleSelection("events", event.id)}
                  title={event.title}
                  subtitle={event.dateLabel}
                  meta={`${event.status} · ${event.tone} · Порядок: ${event.sortOrder}`}
                  inlineActions={[
                    {
                      label: "Порядок",
                      value: event.sortOrder,
                      icon: <ArrowDown className="h-3.5 w-3.5" />,
                      disabled: updateEvent.isPending,
                      onClick: async () => {
                        const nextSortOrder = event.sortOrder + 1;
                        await updateEvent.mutateAsync({
                          id: event.id,
                          title: event.title,
                          dateLabel: event.dateLabel,
                          description: event.description,
                          status: event.status,
                          tone: event.tone,
                          sortOrder: nextSortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("event", { title: event.title, sortOrder: nextSortOrder, status: event.status });
                        toast.success(toastCopy.sortOrder.title, {
                          description: toastCopy.sortOrder.description,
                        });
                        setActionLog((current) => recordAdminAction(current, "events", "update", toastCopy.sortOrder.title, toastCopy.sortOrder.description));
                      },
                    },
                    {
                      label: "Статус",
                      value: event.status,
                      icon: <CalendarRange className="h-3.5 w-3.5" />,
                      disabled: updateEvent.isPending,
                      onClick: async () => {
                        const nextStatus = event.status === "Открыта регистрация" ? "Мест нет" : "Открыта регистрация";
                        await updateEvent.mutateAsync({
                          id: event.id,
                          title: event.title,
                          dateLabel: event.dateLabel,
                          description: event.description,
                          status: nextStatus,
                          tone: event.tone,
                          sortOrder: event.sortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("event", { title: event.title, sortOrder: event.sortOrder, status: nextStatus });
                        toast.success(toastCopy.status.title, {
                          description: toastCopy.status.description,
                        });
                        setActionLog((current) => recordAdminAction(current, "events", "update", toastCopy.status.title, toastCopy.status.description));
                      },
                    },
                  ]}
                  onEdit={() => setEventForm({
                    id: event.id,
                    title: event.title,
                    dateLabel: event.dateLabel,
                    description: event.description,
                    status: event.status,
                    tone: event.tone,
                    sortOrder: event.sortOrder,
                  })}
                  onDelete={() => setPendingDelete({
                    entity: "event",
                    id: event.id,
                    title: event.title,
                    description: `событие «${event.title}»`,
                  })}
                  deleting={isDeleting && pendingDelete?.entity === "event" && pendingDelete.id === event.id}
                />
              )}
            />
          </TabsContent>

          <TabsContent value="members" className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <EntityFormCard
              title={memberForm.id ? "Редактировать участника" : "Новый участник"}
              description="Поддерживайте клубный список актуальным и аккуратно отсортированным."
              footer={
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={handleMemberSubmit}
                    disabled={createMember.isPending || updateMember.isPending}
                  >
                    {memberForm.id ? "Сохранить участника" : "Добавить участника"}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setMemberForm(defaultMemberForm());
                    setMemberErrors({});
                  }}>Очистить</Button>
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Имя" error={memberErrors.name}><Input aria-invalid={Boolean(memberErrors.name)} value={memberForm.name} onChange={(e) => {
                  const value = e.target.value;
                  setMemberForm({ ...memberForm, name: value });
                  if (memberErrors.name) setMemberErrors((current: typeof memberErrors) => ({ ...current, name: undefined }));
                }} /></Field>
                <Field label="Животное" error={memberErrors.animal}><Input aria-invalid={Boolean(memberErrors.animal)} value={memberForm.animal} onChange={(e) => {
                  const value = e.target.value;
                  setMemberForm({ ...memberForm, animal: value });
                  if (memberErrors.animal) setMemberErrors((current: typeof memberErrors) => ({ ...current, animal: undefined }));
                }} /></Field>
                <Field label="С нами с" error={memberErrors.sinceLabel}><Input aria-invalid={Boolean(memberErrors.sinceLabel)} value={memberForm.sinceLabel} onChange={(e) => {
                  const value = e.target.value;
                  setMemberForm({ ...memberForm, sinceLabel: value });
                  if (memberErrors.sinceLabel) setMemberErrors((current: typeof memberErrors) => ({ ...current, sinceLabel: undefined }));
                }} /></Field>
                <Field label="Бейдж"><Input value={memberForm.badge} onChange={(e) => setMemberForm({ ...memberForm, badge: e.target.value })} /></Field>
                <Field label="Порядок"><Input type="number" value={memberForm.sortOrder} onChange={(e) => setMemberForm({ ...memberForm, sortOrder: Number(e.target.value) || 0 })} /></Field>
              </div>
            </EntityFormCard>

            <EntityListCard
              title="Участники клуба"
              description="Ищите по имени, животному или бейджу и быстро поддерживайте состав сообщества в порядке."
              sortIndicator={{
                fieldLabel: memberFilters.sortBy === "name" ? "имени" : memberFilters.sortBy === "badge" ? "бейджу" : "порядку",
                directionLabel: memberFilters.sortDirection === "asc" ? "↑" : "↓",
              }}
              toolbar={
                <FilterToolbar
                  searchPlaceholder="Искать по имени, животному или периоду участия"
                  selectionCount={selectedMembers.length}
                  bulkActions={[
                    {
                      label: allVisibleMembersSelected ? "Снять выбор со всех" : "Выбрать все видимые",
                      icon: allVisibleMembersSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />,
                      variant: "outline",
                      disabled: filteredMembers.length === 0,
                      onClick: () => toggleSelectAllVisible("members", filteredMembers.map((member) => member.id)),
                    },
                    {
                      label: "Удалить выбранных",
                      icon: <Trash2 className="h-4 w-4" />,
                      variant: "outline",
                      destructive: true,
                      disabled: selectedMembers.length === 0 || isDeleting,
                      onClick: () => setPendingDelete({
                        entity: "bulk-member",
                        ids: selectedMembers.map((member) => member.id),
                        title: `Выбрано участников: ${selectedMembers.length}`,
                        description: `${selectedMembers.length} участников`,
                        summaryItems: buildBulkDeleteSummaryItems(selectedMembers),
                        totalCount: selectedMembers.length,
                      }),
                    },
                  ]}
                  onClearSelection={() => clearSelection("members")}
                  presetPanel={
                    <PresetToolbar
                      presetName={presetName.members}
                      onPresetNameChange={(value) => setPresetName((current) => ({ ...current, members: value }))}
                      onSave={() => void handleSavePreset("members")}
                      saveDisabled={createPreset.isPending}
                      presets={presetsByTab.members}
                      onApplyPreset={applyPreset}
                      onDeletePreset={(presetId) => void deletePreset.mutateAsync({ id: presetId })}
                      deletePending={deletePreset.isPending}
                    />
                  }
                  searchValue={memberFilters.query}
                  resultCount={filteredMembers.length}
                  resultLabel="участников"
                  resetLabel="Сбросить фильтры участников"
                  activeFilterChips={[
                    memberFilters.query
                      ? { label: `Поиск: ${memberFilters.query}`, onRemove: () => setMemberFilters((current) => ({ ...current, query: "" })) }
                      : null,
                    memberFilters.badge !== "all"
                      ? { label: `Бейдж: ${memberFilters.badge}`, onRemove: () => setMemberFilters((current) => ({ ...current, badge: "all" })) }
                      : null,
                    memberFilters.sortBy !== "sortOrder"
                      ? { label: `Сортировка: ${memberFilters.sortBy === "name" ? "имя" : "бейдж"}`, onRemove: () => setMemberFilters((current) => ({ ...current, sortBy: "sortOrder" })) }
                      : null,
                    memberFilters.sortDirection !== "asc"
                      ? { label: "Порядок: по убыванию", onRemove: () => setMemberFilters((current) => ({ ...current, sortDirection: "asc" })) }
                      : null,
                  ].filter(Boolean) as FilterChip[]}
                  onSearchChange={(value) => setMemberFilters((current) => ({ ...current, query: value }))}
                  onReset={() => setMemberFilters(defaultMemberFilters())}
                  hasActiveFilters={memberFilters.query !== "" || memberFilters.badge !== "all" || memberFilters.sortBy !== "sortOrder" || memberFilters.sortDirection !== "asc"}
                >
                  <SelectFilter
                    label="Бейдж"
                    value={memberFilters.badge}
                    onChange={(value) => setMemberFilters((current) => ({ ...current, badge: value }))}
                    options={[{ label: "Все бейджи", value: "all" }, ...memberBadges.map((value) => ({ label: value, value }))]}
                  />
                  <SelectFilter
                    label="Сортировать по"
                    value={memberFilters.sortBy}
                    onChange={(value) => setMemberFilters((current) => ({ ...current, sortBy: value as MemberSortField }))}
                    options={[
                      { label: "Порядок", value: "sortOrder" },
                      { label: "Имени", value: "name" },
                      { label: "Бейджу", value: "badge" },
                    ]}
                  />
                  <SelectFilter
                    label="Направление"
                    value={memberFilters.sortDirection}
                    onChange={(value) => setMemberFilters((current) => ({ ...current, sortDirection: value as SortDirection }))}
                    options={[
                      { label: "По возрастанию", value: "asc" },
                      { label: "По убыванию", value: "desc" },
                    ]}
                  />
                </FilterToolbar>
              }
              items={paginatedMembers}
              pagination={buildPaginationMeta(filteredMembers.length, pagination.members.page, pagination.members.pageSize, totalPages.members)}
              onPageChange={(page) => setTabPage("members", page)}
              onPageSizeChange={(pageSize) => setTabPageSize("members", pageSize)}
              emptyText="По текущим фильтрам участники не найдены."
              renderItem={(member: any) => (
                <ListRow
                  selected={selectedIds.members.includes(member.id)}
                  onToggleSelected={() => toggleSelection("members", member.id)}
                  title={member.name}
                  subtitle={member.animal}
                  meta={`${member.sinceLabel} · ${member.badge} · Порядок: ${member.sortOrder}`}
                  inlineActions={[
                    {
                      label: "Порядок",
                      value: member.sortOrder,
                      icon: <ArrowDown className="h-3.5 w-3.5" />,
                      disabled: updateMember.isPending,
                      onClick: async () => {
                        const nextSortOrder = member.sortOrder + 1;
                        await updateMember.mutateAsync({
                          id: member.id,
                          name: member.name,
                          animal: member.animal,
                          sinceLabel: member.sinceLabel,
                          badge: member.badge,
                          sortOrder: nextSortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("member", { name: member.name, sortOrder: nextSortOrder, badge: member.badge });
                        toast.success(toastCopy.sortOrder.title, {
                          description: toastCopy.sortOrder.description,
                        });
                        setActionLog((current) => recordAdminAction(current, "members", "update", toastCopy.sortOrder.title, toastCopy.sortOrder.description));
                      },
                    },
                    {
                      label: "Бейдж",
                      value: member.badge || "без бейджа",
                      icon: <Crown className="h-3.5 w-3.5" />,
                      disabled: updateMember.isPending,
                      onClick: async () => {
                        const nextBadge = member.badge === "Амбассадор" ? "Гость фермы" : "Амбассадор";
                        await updateMember.mutateAsync({
                          id: member.id,
                          name: member.name,
                          animal: member.animal,
                          sinceLabel: member.sinceLabel,
                          badge: nextBadge,
                          sortOrder: member.sortOrder,
                        });
                        const toastCopy = getInlineActionToastCopy("member", { name: member.name, sortOrder: member.sortOrder, badge: nextBadge });
                        toast.success(toastCopy.status.title, {
                          description: toastCopy.status.description,
                        });
                        setActionLog((current) => recordAdminAction(current, "members", "update", toastCopy.status.title, toastCopy.status.description));
                      },
                    },
                  ]}
                  onEdit={() => setMemberForm({
                    id: member.id,
                    name: member.name,
                    animal: member.animal,
                    sinceLabel: member.sinceLabel,
                    badge: member.badge,
                    sortOrder: member.sortOrder,
                  })}
                  onDelete={() => setPendingDelete({
                    entity: "member",
                    id: member.id,
                    title: member.name,
                    description: `участника «${member.name}»`,
                  })}
                  deleting={isDeleting && pendingDelete?.entity === "member" && pendingDelete.id === member.id}
                />
              )}
            />
          </TabsContent>

          <TabsContent value="bitrix" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Всего лидов" value={bitrixSummary?.totalLeads ?? 0} icon={<Users className="h-4 w-4" />} />
              <MetricCard label="В очереди / retry" value={(bitrixSummary?.pendingLeads ?? 0) + (bitrixSummary?.retriedLeads ?? 0)} icon={<RefreshCw className="h-4 w-4" />} />
              <MetricCard label="Успешно синхронизировано" value={bitrixSummary?.successfulLeads ?? 0} icon={<CheckSquare className="h-4 w-4" />} />
              <MetricCard label="Ошибки аудита" value={bitrixSummary?.failedAudits ?? 0} icon={<ShieldAlert className="h-4 w-4" />} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-stone-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-stone-950">Операционные уведомления Bitrix24</CardTitle>
                      <CardDescription className="text-stone-600">
                        Последние сигналы по новым заявкам, failed sync, retry и refresh snapshot. Блок помогает быстро понять, что требует реакции менеджера.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                      Health score: {Math.max(0, 100 - ((bitrixSummary?.failedLeads ?? 0) * 12 + (bitrixSummary?.failedAudits ?? 0) * 7 + (bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0) * 9))}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Новые заявки</p>
                      <p className="mt-2 text-2xl font-semibold text-stone-950">{bitrixSummary?.totalLeads ?? 0}</p>
                      <p className="mt-1 text-xs text-stone-500">Все лиды, доступные в live CRM-ленте.</p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-rose-500">Failed без retry</p>
                      <p className="mt-2 text-2xl font-semibold text-rose-900">{bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0}</p>
                      <p className="mt-1 text-xs text-rose-700/80">Заявки, которые сейчас сильнее всего требуют ручного действия.</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-amber-600">Повторные попытки</p>
                      <p className="mt-2 text-2xl font-semibold text-amber-900">{bitrixRetryMonitoring?.repeatedAttemptLeadCount ?? 0}</p>
                      <p className="mt-1 text-xs text-amber-800/80">Лиды, по которым уже шли retry-циклы.</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-emerald-600">Snapshot-ready</p>
                      <p className="mt-2 text-2xl font-semibold text-emerald-900">{visibleBitrixLeads.filter((lead: any) => Boolean(lead.bitrixDealId)).length}</p>
                      <p className="mt-1 text-xs text-emerald-800/80">Лиды на текущей выборке, где уже можно делать refresh snapshot.</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      {
                        title: "Новые партнёрские заявки",
                        tone: "border-sky-200 bg-sky-50/80 text-sky-900",
                        body: `Зафиксировано лидов: ${bitrixSummary?.totalLeads ?? 0}. Последний проблемный lead ID: ${bitrixRetryMonitoring?.latestFailedLeadId ?? "—"}.`,
                      },
                      {
                        title: "Failed sync и delivery risk",
                        tone: (bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0) > 0 ? "border-rose-200 bg-rose-50/80 text-rose-900" : "border-emerald-200 bg-emerald-50/80 text-emerald-900",
                        body: (bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0) > 0
                          ? `Есть ${bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0} заявки без retry. Стоит открыть detail-view и повторить синхронизацию.`
                          : "Сейчас нет failed-заявок без retry; ручное вмешательство не требуется.",
                      },
                      {
                        title: "Retry и snapshot активность",
                        tone: "border-amber-200 bg-amber-50/80 text-amber-900",
                        body: `Retry lead count: ${bitrixRetryMonitoring?.retryLeadCount ?? 0}. Аудитов интеграции: ${bitrixSummary?.totalAudits ?? 0}, из них failed: ${bitrixSummary?.failedAudits ?? 0}.`,
                      },
                      {
                        title: "Операционный совет",
                        tone: "border-stone-200 bg-stone-50/80 text-stone-900",
                        body: selectedBitrixLead
                          ? `Сейчас в фокусе заявка #${selectedBitrixLead.id}. Ниже можно увидеть payload, полную историю retry/snapshot и audit trail по выбранному лиду.`
                          : "Выберите лид в live-ленте, чтобы справа открыть full payload, retry/snapshot history и связанный audit trail.",
                      },
                    ].map((item) => (
                      <div key={item.title} className={`rounded-2xl border p-4 ${item.tone}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{item.title}</p>
                            <p className="mt-2 text-sm leading-6">{item.body}</p>
                          </div>
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-stone-950">Sync-health мониторинг</CardTitle>
                      <CardDescription className="text-stone-600">
                        Компактная операционная сводка по failed without retry, repeated attempts и качеству текущей выборки из server-side фильтров.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                      onClick={() => void refreshAdminData()}
                      disabled={bitrixAdminQuery.isLoading || bitrixAdminQuery.isRefetching}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Обновить CRM-ленту
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-stone-950">Ключевые риски синхронизации</p>
                        <p className="text-xs text-stone-500">Подходит для ежедневного админ-контроля без перехода в отдельные отчёты.</p>
                      </div>
                      <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                        {visibleBitrixLeads.length} в текущей выборке
                      </Badge>
                    </div>
                    <div className="space-y-3 text-sm text-stone-700">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                        <span>Failed without retry</span>
                        <strong className="text-stone-950">{bitrixRetryMonitoring?.failedWithoutRetryCount ?? 0}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                        <span>Repeated attempt leads</span>
                        <strong className="text-stone-950">{bitrixRetryMonitoring?.repeatedAttemptLeadCount ?? 0}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                        <span>Retry lead count</span>
                        <strong className="text-stone-950">{bitrixRetryMonitoring?.retryLeadCount ?? 0}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                        <span>Failed audits</span>
                        <strong className="text-stone-950">{bitrixSummary?.failedAudits ?? 0}</strong>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
              <Card className="border-stone-200 bg-white/90 shadow-none">
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base text-stone-950">Live-лиды партнёрской воронки</CardTitle>
                      <CardDescription className="text-stone-600">
                        Видно CRM-статус, менеджера, stage сделки и действия для ручного retry или refresh snapshot прямо из админ-панели.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                      server-side filters active
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Поиск по заявке">
                      <input
                        value={bitrixQuery.query}
                        onChange={(event) => setBitrixQuery((current) => ({ ...current, page: 1, query: event.target.value }))}
                        placeholder="Компания, контакт, email"
                        className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                      />
                    </Field>
                    <Field label="Sync status">
                      <select
                        value={bitrixQuery.syncStatus}
                        onChange={(event) => setBitrixQuery((current) => ({ ...current, page: 1, syncStatus: event.target.value as "all" | "pending" | "success" | "failed" | "retried" }))}
                        className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                      >
                        <option value="all">Все статусы</option>
                        <option value="pending">pending</option>
                        <option value="success">success</option>
                        <option value="failed">failed</option>
                        <option value="retried">retried</option>
                      </select>
                    </Field>
                    <Field label="Источник">
                      <select
                        value={bitrixQuery.source}
                        onChange={(event) => setBitrixQuery((current) => ({ ...current, page: 1, source: event.target.value as "all" | "website" | "club" | "referral" | "manual" }))}
                        className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                      >
                        <option value="all">Все источники</option>
                        <option value="website">website</option>
                        <option value="club">club</option>
                        <option value="referral">referral</option>
                        <option value="manual">manual</option>
                      </select>
                    </Field>
                    <Field label="Ошибки синхронизации">
                      <select
                        value={bitrixErrorFilter}
                        onChange={(event) => {
                          const nextValue = event.target.value as "all" | "with_error" | "without_error";
                          setBitrixErrorFilter(nextValue);
                          setBitrixQuery((current) => ({ ...current, page: 1, onlyFailed: nextValue === "with_error" }));
                        }}
                        className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                      >
                        <option value="all">Все лиды</option>
                        <option value="with_error">Только с ошибками</option>
                        <option value="without_error">Без ошибок</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-3 text-sm text-stone-600">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>Показано лидов: <strong className="text-stone-950">{visibleBitrixLeads.length}</strong></span>
                      <span>Всего по серверным фильтрам: <strong className="text-stone-950">{bitrixPagination?.totalFilteredLeads ?? visibleBitrixLeads.length}</strong></span>
                      <span>Страница <strong className="text-stone-950">{bitrixPagination?.page ?? bitrixQuery.page}</strong> / {bitrixPagination?.pageCount ?? 1}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                        Повторные попытки: {bitrixSummary?.retriedLeads ?? 0}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                        Ошибки: {bitrixSummary?.failedLeads ?? 0}
                      </Badge>
                    </div>
                  </div>
                  {visibleBitrixLeads.length ? (
                    <div className="space-y-3">
                      {visibleBitrixLeads.map((lead: any) => {
                        const statusTone = lead.syncStatus === "success"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : lead.syncStatus === "failed"
                            ? "border-rose-200 bg-rose-50 text-rose-800"
                            : lead.syncStatus === "retried"
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "border-sky-200 bg-sky-50 text-sky-800";

                        return (
                          <div
                            key={lead.id}
                            className={selectedBitrixLead?.id === lead.id
                              ? "rounded-2xl border border-stone-900 bg-stone-100 p-4 shadow-[inset_0_0_0_1px_rgba(28,25,23,0.08)]"
                              : "rounded-2xl border border-stone-200 bg-stone-50/80 p-4"}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-stone-950">#{lead.id} · {lead.companyName}</p>
                                  <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] ${statusTone}`}>
                                    {lead.syncStatus}
                                  </Badge>
                                  {lead.bitrixStageId ? (
                                    <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                                      Stage: {lead.bitrixStageId}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="text-sm text-stone-600">{lead.fullName} · {lead.email}{lead.phone ? ` · ${lead.phone}` : ""}</p>
                                <div className="flex flex-wrap gap-3 text-xs text-stone-500">
                                  <span>Интерес: {lead.interestType}</span>
                                  <span>Источник: {lead.source}</span>
                                  <span>Попытки sync: {lead.syncAttemptCount}</span>
                                  <span>Менеджер: {lead.assignedManagerName || "не назначен"}</span>
                                  <span>Deal ID: {lead.bitrixDealId || "—"}</span>
                                </div>
                                {lead.lastSyncError ? (
                                  <p className="text-xs leading-5 text-rose-700">Ошибка: {lead.lastSyncError}</p>
                                ) : null}
                                <p className="text-xs text-stone-500">
                                  Следующая активность: {lead.nextActivityAt ? new Date(lead.nextActivityAt).toLocaleString("ru-RU") : "ещё не запланирована"}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                                  onClick={() => setSelectedBitrixLeadId(lead.id)}
                                >
                                  {selectedBitrixLead?.id === lead.id ? "Открыто" : "Открыть detail-view"}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                                  onClick={() => void retryLeadSync.mutateAsync({ leadId: lead.id })}
                                  disabled={retryLeadSync.isPending}
                                >
                                  Retry sync
                                </Button>
                                <Button
                                  type="button"
                                  className="rounded-full bg-stone-950 text-white hover:bg-stone-800"
                                  onClick={() => void refreshDealSnapshot.mutateAsync({ leadId: lead.id })}
                                  disabled={!lead.bitrixDealId || refreshDealSnapshot.isPending}
                                >
                                  Refresh snapshot
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-5 text-sm text-stone-500">
                      По текущим фильтрам лиды не найдены. Измените server-side статус, поиск, источник или режим ошибок, чтобы вернуть заявки в CRM-мониторинг.
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-2">
                    <div className="text-sm text-stone-500">
                      Следующая страница доступна, если сервер вернёт больше лидов по текущему фильтру.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                        onClick={() => setBitrixQuery((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                        disabled={(bitrixPagination?.page ?? bitrixQuery.page) <= 1 || bitrixAdminQuery.isFetching}
                      >
                        Предыдущая страница
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                        onClick={() => setBitrixQuery((current) => ({ ...current, page: current.page + 1 }))}
                        disabled={Boolean(bitrixPagination && (bitrixPagination.page >= bitrixPagination.pageCount)) || bitrixAdminQuery.isFetching}
                      >
                        Следующая страница
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="border-stone-200 bg-white/90 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base text-stone-950">Detail-view заявки</CardTitle>
                    <CardDescription className="text-stone-600">
                      Карточка выбранного лида: видно контакт, CRM-связки, next activity, ошибки sync, полный payload и ручные действия из текущего контекста.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedBitrixLead ? (
                      <>
                        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-stone-950">#{selectedBitrixLead.id} · {selectedBitrixLead.companyName}</p>
                                <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-stone-700">
                                  {selectedBitrixLead.syncStatus}
                                </Badge>
                                {selectedBitrixLead.bitrixStageId ? (
                                  <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                                    Stage: {selectedBitrixLead.bitrixStageId}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-sm text-stone-600">{selectedBitrixLead.fullName} · {selectedBitrixLead.email}{selectedBitrixLead.phone ? ` · ${selectedBitrixLead.phone}` : ""}</p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Менеджер</p>
                                  <p className="mt-2 font-medium text-stone-950">{selectedBitrixLead.assignedManagerName || "Не назначен"}</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Следующая активность</p>
                                  <p className="mt-2 font-medium text-stone-950">{selectedBitrixLead.nextActivityAt ? new Date(selectedBitrixLead.nextActivityAt).toLocaleString("ru-RU") : "Не запланирована"}</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">CRM IDs</p>
                                  <p className="mt-2 leading-6 text-stone-950">Deal: {selectedBitrixLead.bitrixDealId || "—"}<br />Lead: {selectedBitrixLead.bitrixLeadId || "—"}<br />Contact: {selectedBitrixLead.bitrixContactId || "—"}</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                                  <p className="text-xs uppercase tracking-[0.12em] text-stone-400">Sync attempts</p>
                                  <p className="mt-2 font-medium text-stone-950">{selectedBitrixLead.syncAttemptCount}</p>
                                  <p className="mt-1 text-xs text-stone-500">Последний sync: {selectedBitrixLead.lastSyncAt ? new Date(selectedBitrixLead.lastSyncAt).toLocaleString("ru-RU") : "ещё не запускался"}</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                                onClick={() => void retryLeadSync.mutateAsync({ leadId: selectedBitrixLead.id })}
                                disabled={retryLeadSync.isPending}
                              >
                                Retry sync
                              </Button>
                              <Button
                                type="button"
                                className="rounded-full bg-stone-950 text-white hover:bg-stone-800"
                                onClick={() => void refreshDealSnapshot.mutateAsync({ leadId: selectedBitrixLead.id })}
                                disabled={!selectedBitrixLead.bitrixDealId || refreshDealSnapshot.isPending}
                              >
                                Refresh snapshot
                              </Button>
                            </div>
                          </div>
                          {selectedBitrixLead.lastSyncError ? (
                            <Alert className="mt-4 border-rose-200 bg-rose-50/80 text-rose-900">
                              <ShieldAlert className="h-4 w-4" />
                              <AlertTitle>Последняя ошибка синхронизации</AlertTitle>
                              <AlertDescription>{selectedBitrixLead.lastSyncError}</AlertDescription>
                            </Alert>
                          ) : null}
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-stone-950">Timeline sync attempts</p>
                                <p className="text-xs text-stone-500">Локальная временная шкала строится из CRM-счётчиков и связанных audit-записей по выбранному лиду.</p>
                              </div>
                              <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                                {selectedBitrixLeadAudits.length} audit events
                              </Badge>
                            </div>
                            <div className="space-y-3">
                              <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-3">
                                <p className="text-sm font-medium text-stone-900">Старт лидогенерации</p>
                                <p className="text-xs text-stone-500">Создано: {selectedBitrixLead.createdAt ? new Date(selectedBitrixLead.createdAt).toLocaleString("ru-RU") : "дата недоступна"}</p>
                              </div>
                              {selectedBitrixLeadAudits.slice(0, 6).map((audit: any) => (
                                <div key={audit.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="space-y-1">
                                      <p className="text-sm font-medium text-stone-950">{audit.operation} · {audit.entityType}</p>
                                      <p className="text-xs text-stone-500">{audit.externalId ? `External ID: ${audit.externalId}` : "Без внешнего ID"}</p>
                                      {audit.errorMessage ? <p className="text-xs leading-5 text-rose-700">{audit.errorMessage}</p> : null}
                                    </div>
                                    <Badge variant="outline" className={audit.status === "success" ? "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-800" : audit.status === "failed" ? "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] text-rose-800" : "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] text-sky-800"}>
                                      {audit.status}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-xs text-stone-500">{new Date(audit.createdAt).toLocaleString("ru-RU")}</p>
                                </div>
                              ))}
                              {!selectedBitrixLeadAudits.length ? (
                                <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-4 text-sm text-stone-500">
                                  Для этой заявки audit trail пока пуст. После retry sync или refresh snapshot здесь появятся события таймлайна.
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-stone-950">Полный payload и CRM metadata</p>
                                  <p className="text-xs text-stone-500">Быстрый просмотр ключевых полей заявки без обращения к базе или вебхуку вручную.</p>
                                </div>
                                <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                                  Lead #{selectedBitrixLead.id}
                                </Badge>
                              </div>
                              <div className="rounded-2xl border border-stone-200 bg-white p-4">
                                <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-stone-700">{JSON.stringify({
                                  id: selectedBitrixLead.id,
                                  companyName: selectedBitrixLead.companyName,
                                  fullName: selectedBitrixLead.fullName,
                                  email: selectedBitrixLead.email,
                                  phone: selectedBitrixLead.phone,
                                  telegram: selectedBitrixLead.telegram,
                                  region: selectedBitrixLead.region,
                                  source: selectedBitrixLead.source,
                                  interestType: selectedBitrixLead.interestType,
                                  preferredContactMethod: selectedBitrixLead.preferredContactMethod,
                                  interestProducts: selectedBitrixLead.interestProducts,
                                  notes: selectedBitrixLead.notes,
                                  syncStatus: selectedBitrixLead.syncStatus,
                                  syncAttemptCount: selectedBitrixLead.syncAttemptCount,
                                  lastSyncAt: selectedBitrixLead.lastSyncAt,
                                  lastSyncError: selectedBitrixLead.lastSyncError,
                                  bitrixStageId: selectedBitrixLead.bitrixStageId,
                                  bitrixDealId: selectedBitrixLead.bitrixDealId,
                                  bitrixLeadId: selectedBitrixLead.bitrixLeadId,
                                  bitrixContactId: selectedBitrixLead.bitrixContactId,
                                  assignedManagerId: selectedBitrixLead.assignedManagerId,
                                  assignedManagerName: selectedBitrixLead.assignedManagerName,
                                  nextActivityAt: selectedBitrixLead.nextActivityAt,
                                  createdAt: selectedBitrixLead.createdAt,
                                }, null, 2)}</pre>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-stone-950">Retry / snapshot history</p>
                                  <p className="text-xs text-stone-500">Полная история ручных sync-циклов и pull snapshot по выбранной заявке.</p>
                                </div>
                                <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] text-stone-700">
                                  {selectedBitrixLeadAudits.filter((audit: any) => ["retry", "sync", "pull"].includes(String(audit.operation))).length} relevant events
                                </Badge>
                              </div>
                              <div className="space-y-3">
                                {selectedBitrixLeadAudits.filter((audit: any) => ["retry", "sync", "pull"].includes(String(audit.operation))).slice(0, 10).map((audit: any) => (
                                  <div key={`history-${audit.id}`} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div className="space-y-1">
                                        <p className="text-sm font-medium text-stone-950">{audit.operation === "pull" ? "Refresh snapshot" : audit.operation === "retry" ? "Retry sync" : "Первичная sync"}</p>
                                        <p className="text-xs text-stone-500">{audit.externalId ? `External ID: ${audit.externalId}` : "Без внешнего ID"}</p>
                                        {audit.errorMessage ? <p className="text-xs leading-5 text-rose-700">{audit.errorMessage}</p> : null}
                                      </div>
                                      <Badge variant="outline" className={audit.status === "success" ? "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-800" : audit.status === "failed" ? "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] text-rose-800" : "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] text-sky-800"}>
                                        {audit.status}
                                      </Badge>
                                    </div>
                                    {audit.requestPayload ? (
                                      <details className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                                        <summary className="cursor-pointer text-xs font-medium text-stone-700">Request payload</summary>
                                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-stone-600">{audit.requestPayload}</pre>
                                      </details>
                                    ) : null}
                                    {audit.responsePayload ? (
                                      <details className="mt-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                                        <summary className="cursor-pointer text-xs font-medium text-stone-700">Response payload</summary>
                                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-stone-600">{audit.responsePayload}</pre>
                                      </details>
                                    ) : null}
                                    <p className="mt-2 text-xs text-stone-500">{new Date(audit.createdAt).toLocaleString("ru-RU")}</p>
                                  </div>
                                ))}
                                {!selectedBitrixLeadAudits.filter((audit: any) => ["retry", "sync", "pull"].includes(String(audit.operation))).length ? (
                                  <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-4 text-sm text-stone-500">
                                    История retry/snapshot для этой заявки пока пустая. После новых ручных операций здесь появятся request/response payload и статусы доставки.
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-5 text-sm text-stone-500">
                        Выберите лид слева, чтобы открыть detail-view, CRM-связки, timeline попыток синхронизации, полный payload и retry/snapshot history.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-stone-200 bg-white/90 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base text-stone-950">Audit trail Bitrix24</CardTitle>
                    <CardDescription className="text-stone-600">
                      Последние push/pull операции по интеграции: видно статус, entity, внешний ID и ошибки синхронизации.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {bitrixAudits.length ? (
                      bitrixAudits.slice(0, 12).map((audit: any) => (
                        <div key={audit.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-stone-950">{audit.operation} · {audit.entityType}</p>
                                <Badge variant="outline" className={audit.status === "success" ? "rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] text-emerald-800" : audit.status === "failed" ? "rounded-full border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] text-rose-800" : "rounded-full border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] text-sky-800"}>
                                  {audit.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-stone-500">Lead #{audit.entityId} · External ID: {audit.externalId || "—"}</p>
                              {audit.errorMessage ? <p className="text-xs leading-5 text-rose-700">{audit.errorMessage}</p> : null}
                            </div>
                            <span className="text-xs text-stone-500">{new Date(audit.createdAt).toLocaleString("ru-RU")}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-5 text-sm text-stone-500">
                        Аудит интеграции пока пуст. После первой отправки или refresh snapshot здесь появятся push/pull записи.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="activity" className="space-y-6">
            <Card className="border-stone-200 bg-white/90">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>Последние действия администратора</CardTitle>
                    <CardDescription>Короткий локальный журнал последних операций в этой сессии для прозрачности изменений в клубной панели.</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge variant="outline" className="rounded-full border-stone-300 bg-stone-50 px-3 py-1 text-xs text-stone-700">
                      {actionLog.length} записей
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-stone-300 px-3 text-stone-700"
                      onClick={() => setActionLogCollapsed((current) => !current)}
                    >
                      {actionLogCollapsed ? <ChevronDown className="mr-1.5 h-4 w-4" /> : <ChevronUp className="mr-1.5 h-4 w-4" />}
                      {actionLogCollapsed ? "Развернуть" : "Свернуть"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-stone-300 px-3 text-stone-700"
                      onClick={copyCurrentViewLink}
                    >
                      <Copy className="mr-1.5 h-4 w-4" />
                      Скопировать ссылку
                    </Button>
                    <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-3 py-1 text-xs text-stone-700">
                      Видимо сейчас: {filteredActionLog.length}
                    </Badge>
                    <Select value={actionLogExportScope} onValueChange={(value) => setActionLogExportScope(value as "filtered" | "all")}>
                      <SelectTrigger className="h-9 w-[220px] rounded-full border-stone-300 bg-white text-xs text-stone-700">
                        <SelectValue placeholder="Глубина экспорта" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="filtered">Экспорт: текущий вид</SelectItem>
                        <SelectItem value="all">Экспорт: весь журнал сессии</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-stone-300 px-3 text-stone-700"
                      onClick={exportActionLogToCsv}
                      disabled={!exportableActionLog.length}
                    >
                      <Download className="mr-1.5 h-4 w-4" />
                      CSV
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full border-stone-300 px-3 text-stone-700"
                      onClick={() => setActionLog([])}
                      disabled={!actionLog.length}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Очистить
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {actionLogCollapsed ? (
                <CardContent>
                  <p className="text-sm text-stone-500">Журнал свёрнут. Разверните блок, чтобы посмотреть последние действия администратора и применить фильтры.</p>
                </CardContent>
              ) : (
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="sticky top-3 z-10 -mx-1 space-y-3 rounded-2xl border border-stone-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
                      <div className="flex flex-wrap gap-2">
                        {actionLogFilterPresets.map((preset) => {
                          const matchesArea = actionLogAreaFilter === preset.area;
                          const matchesType = preset.actionTypes?.length
                            ? preset.actionTypes.includes(actionLogTypeFilter as AdminActionType)
                            : actionLogTypeFilter === (preset.actionType ?? "all");
                          const isActive = matchesArea && matchesType;

                          return (
                            <Button
                              key={preset.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              className={isActive
                                ? "rounded-full border-stone-900 bg-stone-900 px-3 text-white hover:bg-stone-800"
                                : "rounded-full border-stone-300 bg-white px-3 text-stone-700 hover:bg-stone-50"}
                              onClick={() => applyActionLogPreset(preset.id)}
                            >
                              {preset.label}
                            </Button>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-3 text-sm text-stone-600">
                        <span>Текущий фильтр показывает {filteredActionLog.length} из {actionLog.length} записей журнала.</span>
                        <span>Режим экспорта: {actionLogExportScope === "all" ? "весь журнал сессии" : "только текущий вид"}.</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {actionLogTypeStatsItems.map((item) => (
                          <div key={item.key} className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-600">
                            <p className="text-xs uppercase tracking-[0.12em] text-stone-400">{item.label}</p>
                            <p className="mt-2 text-2xl font-semibold text-stone-950">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {actionLogAreaStatsItems.map((item) => (
                        <div key={item.key} className="rounded-2xl border border-dashed border-stone-200 bg-white/80 px-3 py-3 text-sm text-stone-600">
                          <p className="text-xs uppercase tracking-[0.12em] text-stone-400">{item.label}</p>
                          <p className="mt-2 text-xl font-semibold text-stone-950">{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Область журнала">
                        <select
                          value={actionLogAreaFilter}
                          onChange={(event) => setActionLogAreaFilter(event.target.value as "all" | AdminTabValue)}
                          className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                        >
                          <option value="all">Все области</option>
                          <option value="posts">Посты</option>
                          <option value="events">События</option>
                          <option value="members">Участники</option>
                        </select>
                      </Field>
                      <Field label="Тип операции">
                        <select
                          value={actionLogTypeFilter}
                          onChange={(event) => setActionLogTypeFilter(event.target.value as "all" | AdminActionType)}
                          className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
                        >
                          <option value="all">Все типы</option>
                          <option value="create">Создание</option>
                          <option value="update">Изменение</option>
                          <option value="delete">Удаление</option>
                          <option value="bulk">Массовые операции</option>
                          <option value="preset">Пресеты</option>
                        </select>
                      </Field>
                    </div>
                    <Card className="border-amber-200 bg-amber-50/70 shadow-none">
                      <CardHeader className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
                            <ShieldAlert className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base text-stone-950">Критические уведомления для администраторов</CardTitle>
                            <CardDescription className="text-stone-600">
                              Отправляйте owner-уведомления при удалениях и массовых действиях, которые требуют быстрого внимания.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-white px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-stone-900">Включить критические уведомления</p>
                              <p className="text-xs text-stone-500">Если выключить, журнал останется локальным без отправки owner-оповещений.</p>
                            </div>
                            <Switch
                              checked={criticalNotificationSettings.enabled}
                              onCheckedChange={(checked) => setCriticalNotificationSettings((current) => ({ ...current, enabled: checked }))}
                            />
                          </div>
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-stone-900">Удаления</p>
                                  <p className="text-xs text-stone-500">Оповещать о каждом одиночном удалении.</p>
                                </div>
                                <Switch
                                  checked={criticalNotificationSettings.notifyOnDelete}
                                  onCheckedChange={(checked) => setCriticalNotificationSettings((current) => ({ ...current, notifyOnDelete: checked }))}
                                  disabled={!criticalNotificationSettings.enabled}
                                />
                              </div>
                            </div>
                            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-stone-900">Массовые действия</p>
                                  <p className="text-xs text-stone-500">Учитывать порог затронутых записей.</p>
                                </div>
                                <Switch
                                  checked={criticalNotificationSettings.notifyOnBulk}
                                  onCheckedChange={(checked) => setCriticalNotificationSettings((current) => ({ ...current, notifyOnBulk: checked }))}
                                  disabled={!criticalNotificationSettings.enabled}
                                />
                              </div>
                            </div>
                            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-medium text-stone-900">Пресеты</p>
                                  <p className="text-xs text-stone-500">Отслеживать рискованные изменения пресетов вручную.</p>
                                </div>
                                <Switch
                                  checked={criticalNotificationSettings.notifyOnPreset}
                                  onCheckedChange={(checked) => setCriticalNotificationSettings((current) => ({ ...current, notifyOnPreset: checked }))}
                                  disabled={!criticalNotificationSettings.enabled}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3 rounded-2xl border border-dashed border-amber-200 bg-white px-4 py-4">
                          <Label htmlFor="critical-bulk-threshold" className="text-sm font-medium text-stone-900">Порог для массовых действий</Label>
                          <Input
                            id="critical-bulk-threshold"
                            type="number"
                            min={1}
                            value={criticalNotificationSettings.minBulkCount}
                            onChange={(event) => {
                              const nextValue = Math.max(1, Number(event.target.value) || 1);
                              setCriticalNotificationSettings((current) => ({ ...current, minBulkCount: nextValue }));
                            }}
                            disabled={!criticalNotificationSettings.enabled || !criticalNotificationSettings.notifyOnBulk}
                          />
                          <p className="text-xs leading-5 text-stone-500">
                            Сейчас owner-уведомление отправится, если массовое действие затронет не менее {criticalNotificationSettings.minBulkCount} записей.
                          </p>
                          <Alert className="border-amber-200 bg-amber-50/80 text-amber-900">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle>Критерии критичности</AlertTitle>
                            <AlertDescription>
                              Одиночные удаления считаются критическими сразу. Массовые операции сравниваются с порогом, а пресеты уведомляют только при ручном включении.
                            </AlertDescription>
                          </Alert>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-stone-200 bg-white/90 shadow-none">
                      <CardHeader className="space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base text-stone-950">История критических уведомлений</CardTitle>
                            <CardDescription className="text-stone-600">
                              Последние owner-уведомления по рискованным действиям: видно severity, статус доставки и связь с операцией журнала.
                            </CardDescription>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="rounded-full border-stone-300 bg-stone-50 px-3 py-1 text-xs text-stone-700">
                              Всего: {criticalNotificationHistory.length}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
                              Доставлено: {deliveredCriticalCount}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-800">
                              Сбой: {failedCriticalCount}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {criticalNotificationHistory.length ? (
                          <div className="space-y-3">
                            {criticalNotificationHistory.map((entry) => {
                              const statusBadge = getCriticalNotificationStatusCopy(entry);

                              return (
                                <div key={entry.id} className="rounded-2xl border border-stone-200 bg-stone-50/80 px-4 py-4">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-stone-950">{entry.title}</p>
                                        <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-stone-600">
                                          {getCriticalNotificationAreaLabel(entry.area)}
                                        </Badge>
                                        <Badge variant="outline" className={statusBadge.className}>
                                          {statusBadge.label}
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-stone-600">{entry.description}</p>
                                      <div className="flex flex-wrap gap-2 text-xs text-stone-500">
                                        <span>Действие: {entry.actionType}</span>
                                        <span>Severity: {entry.severityLabel}</span>
                                        <span>Автор: {entry.actorLabel}</span>
                                        {typeof entry.affectedCount === "number" ? <span>Затронуто: {entry.affectedCount}</span> : null}
                                      </div>
                                      <p className="text-xs leading-5 text-stone-500">Причина: {entry.reason}</p>
                                    </div>
                                    <span className="text-xs text-stone-500">
                                      {new Date(entry.timestamp).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-5 text-sm text-stone-500">
                            Пока критические уведомления не отправлялись. Как только администратор выполнит рискованное действие, здесь появится запись со статусом доставки.
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {filteredActionLog.length ? (
                      <div className="space-y-4">
                        {groupedActionLog.map((group) => (
                          <div key={group.key} className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 px-4 py-2">
                              <p className="text-sm font-semibold text-stone-900">{group.dateLabel}</p>
                              <div className="flex items-center gap-2 text-xs text-stone-500">
                                <span className="rounded-full bg-white px-2.5 py-1 text-stone-600">{group.hourLabel}</span>
                                <span>{group.entries.length} {group.entries.length === 1 ? "запись" : group.entries.length < 5 ? "записи" : "записей"}</span>
                              </div>
                            </div>
                            {group.entries.map((entry) => {
                              const actionTypeBadge = getActionTypeBadgeConfig(entry.actionType);
                              const includedInExport = exportableActionLogIds.has(entry.id);

                              return (
                                <div
                                  key={entry.id}
                                  className={includedInExport
                                    ? "rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)]"
                                    : "rounded-2xl border border-stone-200 bg-stone-50/70 p-3"}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-semibold text-stone-950">{entry.title}</p>
                                        <Badge variant="outline" className="rounded-full border-stone-300 bg-white px-2.5 py-0.5 text-[11px] uppercase tracking-[0.12em] text-stone-600">
                                          {entry.area === "posts" ? "Посты" : entry.area === "events" ? "События" : entry.area === "members" ? "Участники" : entry.area === "bitrix" ? "Bitrix24" : "Журнал"}
                                        </Badge>
                                        <Badge variant="outline" className={actionTypeBadge.className}>
                                          {actionTypeBadge.label}
                                        </Badge>
                                        {includedInExport ? (
                                          <Badge variant="outline" className="rounded-full border-emerald-300 bg-emerald-100/80 px-2.5 py-0.5 text-[11px] text-emerald-800">
                                            В экспорте
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <p className="text-sm text-stone-600">{entry.description}</p>
                                    </div>
                                    <span className="text-xs text-stone-500">
                                      {new Date(entry.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-stone-200 bg-stone-50/70 px-5 py-8">
                        <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 text-left">
                          <div className="rounded-2xl bg-white p-3 text-stone-700 shadow-sm ring-1 ring-stone-200/80">
                            <ShieldAlert className="h-5 w-5" />
                          </div>
                          <div className="space-y-2">
                            <p className="text-base font-semibold text-stone-950">По текущим фильтрам записи журнала не найдены</p>
                            <p className="text-sm leading-6 text-stone-500">
                              Попробуйте сбросить фильтры или вернуться к последней рабочей вкладке, чтобы продолжить управление контентом без лишней навигации.
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
                              onClick={() => {
                                setActionLogAreaFilter("all");
                                setActionLogTypeFilter("all");
                              }}
                            >
                              Сбросить фильтры
                            </Button>
                            <Button
                              type="button"
                              className="rounded-full bg-stone-950 text-white hover:bg-stone-800"
                              onClick={() => setActiveTab(lastEntityTab)}
                            >
                              <ArrowLeft className="mr-2 h-4 w-4" />
                              Вернуться к вкладке «{lastEntityTab === "posts" ? "Посты" : lastEntityTab === "events" ? "События" : "Участники"}»
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </TabsContent>
