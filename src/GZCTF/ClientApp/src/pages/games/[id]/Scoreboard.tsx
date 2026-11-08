import { Center, SegmentedControl, Stack } from '@mantine/core'
import { useLocalStorage } from '@mantine/hooks'
import { mdiCrown, mdiFlagOutline } from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { KoHScoreboardTable } from '@Components/KoHScoreboardTable'
import { ScoreboardTable } from '@Components/ScoreboardTable'
import { TeamRank } from '@Components/TeamRank'
import { WithGameTab } from '@Components/WithGameTab'
import { WithNavBar } from '@Components/WithNavbar'
import { KoHScoreTimeLine } from '@Components/charts/KoHScoreTimeLine'
import { ScoreTimeLine } from '@Components/charts/ScoreTimeLine'
import { MobileScoreboardTable } from '@Components/mobile/ScoreboardTable'
import { useIsMobile } from '@Utils/ThemeOverride'
import { useGameScoreboard, useGameTeamInfo } from '@Hooks/useGame'

const Scoreboard: FC = () => {
  const { id } = useParams()
  const numId = parseInt(id ?? '-1')
  const { teamInfo, error } = useGameTeamInfo(numId)

  const [divisionId, setDivisionId] = useState<number | null>(null)
  const isMobile = useIsMobile(1080)
  const isVertical = useIsMobile()
  const { t } = useTranslation()
  const { hasKoH, hasJeopardy } = useGameScoreboard(numId)
  const [board, setBoard] = useLocalStorage({
    key: `scoreboard-tab-${numId}`,
    defaultValue: 'jeopardy',
    getInitialValueInEffect: false,
  })
  const showKoH = hasKoH && (board === 'koh' || !hasJeopardy)

  const boardLabel = (icon: string, color: string, label: string) => (
    <Center style={{ gap: 4 }}>
      <Icon path={icon} size={0.8} color={`var(--mantine-color-${color}-6)`} />
      <span>{label}</span>
    </Center>
  )

  const boardSwitch = hasKoH && hasJeopardy && (
    <Center my="xs">
      <SegmentedControl
        size="sm"
        value={showKoH ? 'koh' : 'jeopardy'}
        onChange={setBoard}
        data={[
          { value: 'jeopardy', label: boardLabel(mdiFlagOutline, 'blue', t('game.content.koh.board_jeopardy')) },
          { value: 'koh', label: boardLabel(mdiCrown, 'violet', t('game.content.koh.board_koh')) },
        ]}
      />
    </Center>
  )

  const kohBoard = (
    <>
      <KoHScoreTimeLine gameId={numId} />
      <KoHScoreboardTable gameId={numId} />
    </>
  )

  return (
    <WithNavBar width="90%" minWidth={0}>
      {isMobile ? (
        <Stack pt="md">
          {teamInfo && !error && <TeamRank />}
          {boardSwitch}
          {showKoH ? (
            kohBoard
          ) : isVertical ? (
            <MobileScoreboardTable divisionId={divisionId} setDivisionId={setDivisionId} />
          ) : (
            <ScoreboardTable divisionId={divisionId} setDivisionId={setDivisionId} />
          )}
        </Stack>
      ) : (
        <WithGameTab>
          <Stack pb="2rem">
            {boardSwitch}
            {showKoH ? (
              kohBoard
            ) : (
              <>
                <ScoreTimeLine divisionId={divisionId} />
                <ScoreboardTable divisionId={divisionId} setDivisionId={setDivisionId} />
              </>
            )}
          </Stack>
        </WithGameTab>
      )}
    </WithNavBar>
  )
}

export default Scoreboard
