package dev.lolagateway.ui.onboarding

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import dev.lolagateway.R
import dev.lolagateway.ui.components.ScreenHeading

@Composable
fun OnboardingScreen(
    signedIn: Boolean, configured: Boolean, busy: Boolean, error: String?,
    signIn: () -> Unit, createFamily: (String, String, String) -> Unit,
) {
    var familyName by rememberSaveable { mutableStateOf("") }
    var seniorName by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Image(painterResource(R.drawable.lola_welcome), null,
            Modifier.fillMaxWidth().height(218.dp).clip(RoundedCornerShape(28.dp)), contentScale = ContentScale.Crop)
        ScreenHeading(if (signedIn) "Set up your family" else "Lola Gateway",
            if (signedIn) "This Android phone relays messages to Lola’s keypad phone." else "Keep Lola in the family conversation by SMS.")
        if (error != null) Text(error, color = MaterialTheme.colorScheme.error)
        if (!signedIn) {
            if (!configured) Text("Add your Firebase Android configuration to enable Google Sign-In.")
            Button(signIn, enabled = configured && !busy, modifier = Modifier.fillMaxWidth()) {
                Text(if (busy) "Signing in…" else "Continue with Google")
            }
        } else {
            OutlinedTextField(familyName, { familyName = it }, Modifier.fillMaxWidth(), label = { Text("Family name") }, singleLine = true)
            OutlinedTextField(seniorName, { seniorName = it }, Modifier.fillMaxWidth(), label = { Text("Lola’s name") }, singleLine = true)
            OutlinedTextField(phone, { phone = it }, Modifier.fillMaxWidth(), label = { Text("Lola’s mobile number") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), singleLine = true)
            Button({ createFamily(familyName, seniorName, phone) },
                enabled = !busy && familyName.isNotBlank() && seniorName.isNotBlank() && phone.isNotBlank(), modifier = Modifier.fillMaxWidth()) {
                Text(if (busy) "Creating family…" else "Create family")
            }
        }
    }
}
