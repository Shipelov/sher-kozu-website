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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

