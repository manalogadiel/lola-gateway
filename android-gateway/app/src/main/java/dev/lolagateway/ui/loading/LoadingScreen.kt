package dev.lolagateway.ui.loading

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import dev.lolagateway.R
import dev.lolagateway.ui.components.ScreenHeading

@Composable
fun LoadingScreen() {
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally) {
        Image(painterResource(R.drawable.lola_peeking), null,
            Modifier.size(width = 172.dp, height = 180.dp).clip(RoundedCornerShape(topStart = 86.dp, topEnd = 86.dp, bottomStart = 24.dp, bottomEnd = 24.dp)),
            contentScale = ContentScale.Crop)
        ScreenHeading("Lola Gateway")
        CircularProgressIndicator(Modifier.size(26.dp), strokeWidth = 3.dp)
    }
}
