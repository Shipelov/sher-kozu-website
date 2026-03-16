<AdminClubBitrixTabSection>
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
          </AdminClubBitrixTabSection>