<AdminClubEventsTabSection>
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
          </AdminClubEventsTabSection>