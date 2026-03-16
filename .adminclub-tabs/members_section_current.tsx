<AdminClubMembersTabSection>
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
          </AdminClubMembersTabSection>