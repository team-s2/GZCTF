import { SegmentedControl, Stack } from '@mantine/core'
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
  const { hasKoH } = useGameScoreboard(numId)
  const [board, setBoard] = useState('jeopardy')
  const showKoH = hasKoH && board === 'koh'

  const boardSwitch = hasKoH && (
    <SegmentedControl
      value={board}
      onChange={setBoard}
      data={[
        { value: 'jeopardy', label: t('game.content.koh.board_jeopardy') },
        { value: 'koh', label: t('game.content.koh.board_koh') },
      ]}
    />
  )

  return (
    <WithNavBar width="90%" minWidth={0}>
      {isMobile ? (
        <Stack pt="md">
          {teamInfo && !error && <TeamRank />}
          {boardSwitch}
          {showKoH ? (
            <KoHScoreboardTable gameId={numId} />
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
              <>
                <KoHScoreTimeLine gameId={numId} />
                <KoHScoreboardTable gameId={numId} />
              </>
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
