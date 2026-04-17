{{/*
Expand the name of the chart.
*/}}
{{- define "tt-tournoi.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "tt-tournoi.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "tt-tournoi.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "tt-tournoi.labels" -}}
helm.sh/chart: {{ include "tt-tournoi.chart" . }}
{{ include "tt-tournoi.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "tt-tournoi.selectorLabels" -}}
app.kubernetes.io/name: {{ include "tt-tournoi.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "tt-tournoi.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "tt-tournoi.name" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "tt-tournoi.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "tt-tournoi.name" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Create the name of the service account to use.
*/}}
{{- define "tt-tournoi.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "tt-tournoi.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Return the fully qualified postgresql hostname.
*/}}
{{- define "tt-tournoi.postgresql.fullname" -}}
{{- printf "%s-postgresql" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Return the fully qualified redis hostname.
*/}}
{{- define "tt-tournoi.redis.fullname" -}}
{{- printf "%s-redis-master" .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Return the DATABASE_URL for the backend.
Format: postgresql://user:password@host:5432/database
*/}}
{{- define "tt-tournoi.databaseUrl" -}}
{{- printf "postgresql://%s:%s@%s:5432/%s" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "tt-tournoi.postgresql.fullname" .) .Values.postgresql.auth.database }}
{{- end }}

{{/*
Return the REDIS_URL for the backend.
*/}}
{{- define "tt-tournoi.redisUrl" -}}
{{- printf "redis://%s:6379/0" (include "tt-tournoi.redis.fullname" .) }}
{{- end }}
