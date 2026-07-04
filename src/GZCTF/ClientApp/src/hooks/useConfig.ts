// SPDX-License-Identifier: LicenseRef-GZCTF-Restricted
// Copyright (C) 2022-2025 GZTimeWalker
// Restricted Component - NOT under AGPLv3.
// See licenses/LicenseRef-GZCTF-Restricted.txt
import { useLocalStorage } from '@mantine/hooks'
import dayjs from 'dayjs'
import { useEffect, useRef } from 'react'
import { SWRConfiguration } from 'swr'
import api, { ClientConfig, ContainerPortMappingType } from '@Api'

export const OnceSWRConfig: SWRConfiguration = {
  refreshInterval: 0,
  revalidateOnFocus: false,
}

const RepoMeta = {
  sha: import.meta.env.VITE_APP_GIT_SHA ?? 'unknown',
  rawTag: import.meta.env.VITE_APP_GIT_NAME ?? 'unknown',
  timestamp: import.meta.env.VITE_APP_BUILD_TIMESTAMP ?? '',
  buildTime: import.meta.env.DEV ? dayjs() : dayjs(import.meta.env.VITE_APP_BUILD_TIMESTAMP),
  repo: 'https://github.com/team-s2/GZCTF',
  upstreamRepo: 'https://github.com/GZTimeWalker/GZCTF',
}

export const useConfig = () => {
  const {
    data: config,
    error,
    mutate,
  } = api.info.useInfoGetClientConfig({
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshWhenHidden: false,
    shouldRetryOnError: false,
    refreshWhenOffline: false,
  })

  const [clientConfig, setClientConfig] = useLocalStorage<ClientConfig>({
    key: 'client-config',
    defaultValue: {
      title: 'GZ',
      slogan: 'Hack for fun not for profit',
      portMapping: ContainerPortMappingType.Default,
      footerInfo: null,
      customTheme: null,
      defaultLifetime: 120,
      extensionDuration: 120,
      renewalWindow: 10,
    },
  })

  useEffect(() => {
    if (config) {
      setClientConfig(config)
    }
  }, [config])

  return { config: config ?? clientConfig, error, mutate }
}

export const useCaptchaConfig = () => {
  const { data, error, mutate } = api.info.useInfoGetClientCaptchaInfo({
    refreshInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshWhenHidden: false,
    shouldRetryOnError: false,
    refreshWhenOffline: false,
  })

  return { info: data, error, mutate }
}

export const ValidatedRepoMeta = () => {
  const { sha, rawTag, timestamp, buildTime: buildtime } = RepoMeta

  const tag = rawTag.replace(/-.*$/, '')

  const valid =
    timestamp.length === 20 &&
    buildtime.isValid() &&
    sha.length === 40 &&
    (/^v\d+\.\d+\.\d+$/i.test(tag) || tag === 'develop')

  return { valid, tag, ...RepoMeta }
}

const showBanner = () => {
  const { repo } = ValidatedRepoMeta()
  const rst = '\x1b[0m'
  const bold = '\x1b[1m'
  const brand = '\x1b[38;2;4;202;171m'

  const current = new Date().getFullYear()

  const banner = `
  ██████╗ ███████╗ ${brand}        ${rst}  ██████╗████████╗███████╗
 ██╔════╝ ╚══███╔╝ ${brand} ██╗██╗ ${rst} ██╔════╝╚══██╔══╝██╔════╝
 ██║  ███╗  ███╔╝  ${brand} ╚═╝╚═╝ ${rst} ██║        ██║   █████╗
 ██║   ██║ ███╔╝   ${brand} ██╗██╗ ${rst} ██║        ██║   ██╔══╝
 ╚██████╔╝███████╗ ${brand} ╚═╝╚═╝ ${rst} ╚██████╗   ██║   ██║
  ╚═════╝ ╚══════╝ ${brand}        ${rst}  ╚═════╝   ╚═╝   ╚═╝
`

  console.log(
    `${banner}` +
      `\n${bold}Copyright (C) 2022-${current}, GZTimeWalker & AAA, All rights reserved.${rst}` +
      `\n${bold}License  : ${brand}GNU Affero General Public License v3.0${rst}` +
      `\n${bold}Issues   : ${repo}/issues` +
      '\n'
  )
}

export const useBanner = () => {
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      showBanner()
      mounted.current = true
    }
  }, [])
}
